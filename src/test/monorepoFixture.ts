import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const importOf = (uri: string) => `import '${uri}';\n`;

const files: { [path: string]: string } = {
    '.vscode/settings.json': '{ "dartImport.fixOnSave": true }\n',
    'pubspec.yaml': 'name: workspace_root\n',

    'packages/app/pubspec.yaml': 'name: app\n',
    'packages/app/lib/two.dart': '',
    'packages/app/lib/single/fix.dart': importOf('package:app/two.dart'),
    'packages/app/lib/single/on_save.dart': importOf('package:app/two.dart'),
    'packages/app/lib/single/background.dart': importOf('package:app/two.dart'),
    'packages/app/lib/single/saved.g.dart': importOf('package:app/two.dart'),
    'packages/app/lib/all/fixed.dart': importOf('package:app/two.dart') + importOf('package:other/other.dart'),
    'packages/app/lib/all/generated.g.dart': importOf('package:app/two.dart'),
    'packages/app/test/fixed_test.dart': importOf('package:app/two.dart'),
    'packages/app/build/lib/built.dart': importOf('package:app/two.dart'),
    'packages/app/.dart_tool/lib/tool.dart': importOf('package:app/two.dart'),
    'packages/app/windows/flutter/ephemeral/.plugin_symlinks/plugin/lib/plugin.dart': importOf('package:app/two.dart'),

    'packages/app/example/pubspec.yaml': 'name: app_example\n',
    'packages/app/example/lib/home.dart': '',
    'packages/app/example/lib/single.dart': importOf('package:app_example/home.dart') + importOf('package:app/two.dart'),
    'packages/app/example/lib/all.dart': importOf('package:app_example/home.dart') + importOf('package:app/two.dart'),

    'packages/other/pubspec.yaml': 'name: other\n',
    'packages/other/lib/other.dart': importOf('package:other/deep/deeper.dart'),
    'packages/other/lib/deep/deeper.dart': importOf('package:other/other.dart'),

    'docs/lib/snippet.dart': importOf('package:workspace_root/snippet.dart'),
};

const createMonorepoFixture = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dart-import-'));
    for (const [file, contents] of Object.entries(files)) {
        const filePath = path.join(root, file);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, contents);
    }
    return root;
};

export { createMonorepoFixture };
