import * as assert from 'assert';
import { parsePackageName, isInLib, isGeneratedFile } from '../../main';

suite('#parsePackageName test', () => {
    test('plain name', () => {
        assert.strictEqual(parsePackageName('name: foo\nversion: 1.0.0\n'), 'foo');
    });

    test('quotes, trailing comments and windows line endings', () => {
        assert.strictEqual(parsePackageName('name: "foo"\n'), 'foo');
        assert.strictEqual(parsePackageName('name: foo # the name\n'), 'foo');
        assert.strictEqual(parsePackageName('version: 1.0.0\r\nname: foo\r\n'), 'foo');
    });

    test('ignores nested names', () => {
        assert.strictEqual(parsePackageName('flutter:\n  name: nested\nname: foo\n'), 'foo');
    });

    test('no name', () => {
        assert.strictEqual(parsePackageName('version: 1.0.0\n'), null);
    });
});

suite('#isInLib test', () => {
    test('files in lib', () => {
        assert.strictEqual(isInLib('/root/lib/1.dart', '/root', '/'), true);
        assert.strictEqual(isInLib('/root/lib/foo/1.dart', '/root', '/'), true);
        assert.strictEqual(isInLib('C:\\root\\lib\\1.dart', 'C:\\root', '\\'), true);
    });

    test('files outside of lib', () => {
        assert.strictEqual(isInLib('/root/1.dart', '/root', '/'), false);
        assert.strictEqual(isInLib('/root/test/1.dart', '/root', '/'), false);
        assert.strictEqual(isInLib('/root/lib_old/1.dart', '/root', '/'), false);
        assert.strictEqual(isInLib('/root/docs/lib/1.dart', '/root', '/'), false);
    });
});

suite('#isGeneratedFile test', () => {
    const extensions = ['g.dart', 'freezed.dart'];

    test('generated files', () => {
        assert.strictEqual(isGeneratedFile('/root/lib/1.g.dart', extensions), true);
        assert.strictEqual(isGeneratedFile('/root/lib/1.freezed.dart', extensions), true);
    });

    test('regular files', () => {
        assert.strictEqual(isGeneratedFile('/root/lib/1.dart', extensions), false);
        assert.strictEqual(isGeneratedFile('/root/lib/thing.dart', extensions), false);
        assert.strictEqual(isGeneratedFile('/root/lib/1.dart', []), false);
    });
});
