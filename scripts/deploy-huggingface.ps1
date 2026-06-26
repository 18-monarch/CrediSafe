[CmdletBinding()]
param(
    [string]$SpaceUrl,
    [string]$RemoteName = "huggingface",
    [string]$TemporaryBranch = "hf-backend-deploy"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or is not available in PATH."
}

$repositoryRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repositoryRoot) {
    throw "Run this script from inside the CrediSafe Git repository."
}
Set-Location $repositoryRoot

if (-not (Test-Path "vision_service/Dockerfile")) {
    throw "vision_service/Dockerfile was not found. The repository layout is unexpected."
}

$changes = & git status --porcelain
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect the Git working tree."
}
if ($changes) {
    throw "Commit or stash all changes before deploying. Hugging Face must receive a committed backend revision."
}

$existingRemote = (& git remote get-url $RemoteName 2>$null)
if (-not $existingRemote) {
    if (-not $SpaceUrl) {
        throw "First deployment requires -SpaceUrl, for example https://huggingface.co/spaces/USERNAME/credisafe-vision"
    }
    Invoke-Git remote add $RemoteName $SpaceUrl
    Write-Host "Added remote '$RemoteName'." -ForegroundColor Green
} elseif ($SpaceUrl -and $existingRemote -ne $SpaceUrl) {
    Invoke-Git remote set-url $RemoteName $SpaceUrl
    Write-Host "Updated remote '$RemoteName'." -ForegroundColor Green
}

$branchExists = (& git branch --list $TemporaryBranch)
if ($branchExists) {
    Invoke-Git branch -D $TemporaryBranch
}

try {
    Write-Host "Creating backend-only deployment branch..." -ForegroundColor Cyan
    Invoke-Git subtree split --prefix vision_service -b $TemporaryBranch

    Write-Host "Pushing vision_service to Hugging Face..." -ForegroundColor Cyan
    Invoke-Git push $RemoteName "${TemporaryBranch}:main" --force

    Write-Host "Hugging Face deployment push completed." -ForegroundColor Green
}
finally {
    $branchExistsAfter = (& git branch --list $TemporaryBranch)
    if ($branchExistsAfter) {
        & git branch -D $TemporaryBranch | Out-Null
    }
}
