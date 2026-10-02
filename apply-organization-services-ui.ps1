$ErrorActionPreference = "Stop"

$root = "C:\Users\Elielson\Documents\hub"
Set-Location $root

$settingsPath = "src\modules\settings\SettingsPage.tsx"
$dbPath = "src\shared\types\database.ts"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$settingsFullPath = (Resolve-Path $settingsPath).Path
$dbFullPath = (Resolve-Path $dbPath).Path

$settings = [System.IO.File]::ReadAllText($settingsFullPath, [System.Text.Encoding]::UTF8)
$db = [System.IO.File]::ReadAllText($dbFullPath, [System.Text.Encoding]::UTF8)

# 1) Importa o painel de serviços, se ainda não existir.
if ($settings -notmatch 'OrganizationServicesPanel') {
  $settings = [regex]::Replace(
    $settings,
    '(import\s+\{\s*ProfilePanel\s*\}\s+from\s+"@/modules/profile/ProfilePanel";)',
    '$1' + "`r`n" + 'import { OrganizationServicesPanel } from "./organization-services-panel";',
    1
  )
}

# 2) Adiciona "services" ao tipo View.
if ($settings -notmatch 'type View = [^;]*"services"') {
  $settings = [regex]::Replace(
    $settings,
    'type View = "profile" \| "general" \| ',
    'type View = "profile" | "general" | "services" | ',
    1
  )
}

# 3) Adiciona a aba Serviços logo após Geral, sem depender de acentos/encoding.
if ($settings -notmatch 'value:\s*"services"') {
  $settings = [regex]::Replace(
    $settings,
    '(\{\s*value:\s*"general"\s*,\s*label:\s*"[^"]*"\s*\}\s*,)',
    '$1 { value: "services", label: "Serviços" },',
    1
  )
}

# 4) Renderiza o painel de Serviços logo após o bloco Geral.
if ($settings -notmatch 'view === "services"') {
  $generalPattern = '(\{view === "general" && <OrganizationCard[\s\S]*?editable=\{can\("settings\.manage"\)\}/>\})'
  if ($settings -notmatch $generalPattern) {
    throw "Não encontrei o bloco Geral esperado em SettingsPage.tsx."
  }

  $settings = [regex]::Replace(
    $settings,
    $generalPattern,
    '$1' + "`r`n" + '    {view === "services" && <OrganizationServicesPanel editable={can("settings.manage")}/>}' ,
    1
  )
}

# 5) Adiciona o tipo organization_services ao Database.
if ($db -notmatch 'organization_services:\s*Table<') {
  $serviceType = @'
      organization_services: Table<
        Base & {
          name: string;
          default_price: number | null;
          is_active: boolean;
          position: number;
        }
      >;
'@

  if ($db -notmatch '      organizations:\s*Table<') {
    throw "Não encontrei o ponto de inserção em database.ts."
  }

  $db = [regex]::Replace(
    $db,
    '(\s{6}organizations:\s*Table<)',
    $serviceType + '$1',
    1
  )
}

[System.IO.File]::WriteAllText($settingsFullPath, $settings, $utf8NoBom)
[System.IO.File]::WriteAllText($dbFullPath, $db, $utf8NoBom)

Write-Host "Ajustes da aba Serviços aplicados com sucesso."
