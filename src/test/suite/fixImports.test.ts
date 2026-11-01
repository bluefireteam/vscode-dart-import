import * as assert from 'assert';
import { fixImports, EditorAccess, PackageInfo } from '../../main';

class FakeEditor implements EditorAccess {
    fileName: string;
    lines: string[];

    constructor(fileName: string, lines: string[]) {
        this.fileName = fileName;
        this.lines = lines;
    }

    getFileName(): string {
        return this.fileName;
    }

    getLineCount(): number {
        return this.lines.length;
    }

    getLineAt(idx: number): string {
        return this.lines[idx];
    }

    replaceLineAt(idx: number, newLine: string): Thenable<boolean> {
        this.lines[idx] = newLine;
        return Promise.resolve(true);
    }
}

suite('#fixImports test', () => {
    test('replace a couple of wrong imports, keep the rest', async () => {
        const pathSep = '/';
        const editor: EditorAccess = new FakeEditor('root/lib/foo/1.dart', [
            '',
            'import "package:this_package/foo/2.dart";',
            'import "package:other_package/foo/1.dart";',
            '',
            'import   "package:this_package/bar/1.dart";',
            'import "package:other_package/sam.dart";',
        ]);
        const packageInfo: PackageInfo = {
            projectRoot: 'root',
            projectName: 'this_package',
        };
        const result: number = await fixImports(editor, packageInfo, pathSep);
        assert.equal(2, result);
        assert.equal('import "2.dart";', editor.getLineAt(1));
        assert.equal('import "package:other_package/foo/1.dart";', editor.getLineAt(2));
        assert.equal('import "../bar/1.dart";', editor.getLineAt(4));
        assert.equal('import "package:other_package/sam.dart";', editor.getLineAt(5));
    });

    test('allow for use of as, show, and hide', async () => {
        const editor: EditorAccess = new FakeEditor('/lib/foo/1.dart', [
            'import "package:p/foo/2.dart" as Foo;',
            'import "package:p/foo/2.dart" show Foo;',
            'import "package:p/foo/2.dart" hide Foo;',
        ]);
        const packageInfo: PackageInfo = { projectRoot: '', projectName: 'p' };
        const result: number = await fixImports(editor, packageInfo, '/');
        assert.equal(3, result);
        assert.equal('import "2.dart" as Foo;', editor.getLineAt(0));
        assert.equal('import "2.dart" show Foo;', editor.getLineAt(1));
        assert.equal('import "2.dart" hide Foo;', editor.getLineAt(2));
    });

    test('standardize relative imports', async () => {
        const editor: EditorAccess = new FakeEditor('/lib/foo/1.dart', [
            'import "no_dot.dart";',
            'import "./with_dot.dart" show Foo;',
            'import "../parent.dart";',
        ]);
        const packageInfo: PackageInfo = { projectRoot: '', projectName: 'p' };
        const result: number = await fixImports(editor, packageInfo, '/');
        assert.equal(1, result);
        assert.equal('import "no_dot.dart";', editor.getLineAt(0));
        assert.equal('import "with_dot.dart" show Foo;', editor.getLineAt(1));
        assert.equal('import "../parent.dart";', editor.getLineAt(2));
    });

    const fix = async (lines: string[]) => {
        const editor = new FakeEditor('/lib/foo/1.dart', lines);
        const packageInfo: PackageInfo = { projectRoot: '', projectName: 'p' };
        const count = await fixImports(editor, packageInfo, '/');
        return { count, lines: editor.lines };
    };

    const wrongImport = 'import "package:p/foo/2.dart";';
    const fixedImport = 'import "2.dart";';

    test('skip line comments above imports', async () => {
        for (const comment of ['// ignore_for_file: foo', '/// Library docs']) {
            const result = await fix([comment, wrongImport]);
            assert.equal(1, result.count);
            assert.deepEqual([comment, fixedImport], result.lines);
        }
    });

    test('skip a single line block comment above imports', async () => {
        const result = await fix(['/* header */', wrongImport]);
        assert.equal(1, result.count);
        assert.deepEqual(['/* header */', fixedImport], result.lines);
    });

    test('skip a multi line block comment above imports', async () => {
        const header = ['/*', ' * File: xyz.dart', ' */'];
        const result = await fix([...header, '', wrongImport]);
        assert.equal(1, result.count);
        assert.deepEqual([...header, '', fixedImport], result.lines);
    });

    test('do not touch imports inside block comments', async () => {
        const nested = ['/* outer', '/* inner */', wrongImport, '*/'];
        const result = await fix([...nested, wrongImport]);
        assert.equal(1, result.count);
        assert.deepEqual([...nested, fixedImport], result.lines);
    });

    test('skip library directives above imports', async () => {
        for (const library of ['library foo;', 'library;']) {
            const result = await fix([library, '', wrongImport]);
            assert.equal(1, result.count);
            assert.deepEqual([library, '', fixedImport], result.lines);
        }
    });

    test('keep going after comments between imports', async () => {
        const result = await fix(['import "dart:io";', '// comment', wrongImport]);
        assert.equal(1, result.count);
        assert.deepEqual(['import "dart:io";', '// comment', fixedImport], result.lines);
    });

    test('do not touch commented out imports', async () => {
        const commented = `// ${wrongImport}`;
        const result = await fix([commented, wrongImport]);
        assert.equal(1, result.count);
        assert.deepEqual([commented, fixedImport], result.lines);
    });

    test('stop at the first line that is not a directive or comment', async () => {
        for (const stop of ['part "1.g.dart";', 'class Foo {}']) {
            const result = await fix([stop, wrongImport]);
            assert.equal(0, result.count);
            assert.deepEqual([stop, wrongImport], result.lines);
        }
    });
});