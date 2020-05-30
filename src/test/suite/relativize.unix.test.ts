import * as assert from 'assert';
import { relativize } from '../../main';

suite('#relativize unix test', () => {
    test('Root file path', () => {
        const filePath = '';
        const importPath = 'foo/bar.dart';
        const result = relativize(filePath, importPath, '/');
        assert.equal('foo/bar.dart', result);
    });

    test('Shared root', () => {
        const filePath = 'foo';
        const importPath = 'foo/bar.dart';
        const result = relativize(filePath, importPath, '/');
        assert.equal('bar.dart', result);
    });

    test('One up', () => {
        const filePath = 'foo';
        const importPath = 'bar.dart';
        const result = relativize(filePath, importPath, '/');
        assert.equal('../bar.dart', result);
    });

    test('Some up', () => {
        const filePath = 'foo/bar/john/carl';
        const importPath = 'foo/bar/sam/tom.dart';
        const result = relativize(filePath, importPath, '/');
        assert.equal('../../sam/tom.dart', result);
    });
});