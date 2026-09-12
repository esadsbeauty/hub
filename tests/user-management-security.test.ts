$path = "C:\Users\Elielson\Documents\hub\tests\user-management-security.test.ts"

$content = Get-Clipboard -Raw

[System.IO.File]::WriteAllText(
    $path,
    $content,
    [System.Text.UTF8Encoding]::new($false)
)