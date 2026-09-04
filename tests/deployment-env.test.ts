$path = "C:\Users\Elielson\Documents\hub\tests\deployment-env.test.ts"

$content = Get-Clipboard -Raw

[System.IO.File]::WriteAllText(
    $path,
    $content,
    [System.Text.UTF8Encoding]::new($false)
)