$ErrorActionPreference = 'Stop'

$directories = @(
    'src/views/map',
    'src/views/backtest',
    'src/views/explainability',
    'src/views/shared',
    'src/controllers',
    'src/services',
    'src/routes'
)

$files = @(
    'src/views/map/MapPage.jsx',
    'src/views/map/HabitationMap.jsx',
    'src/views/backtest/BacktestPage.jsx',
    'src/views/explainability/ExplainabilityPanel.jsx',
    'src/views/shared/LoadingState.jsx',
    'src/controllers/useHabitationController.js',
    'src/controllers/useBacktestController.js',
    'src/controllers/useRiskController.js',
    'src/services/apiClient.js',
    'src/services/mapboxService.js',
    'src/routes/AppRoutes.jsx',
    '.env'
)

foreach ($directory in $directories) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

foreach ($file in $files) {
    New-Item -ItemType File -Path $file -Force | Out-Null
}

Write-Host "Fresh React MVC structure created successfully."