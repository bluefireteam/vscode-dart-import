import * as assert from 'assert';
import { relativize } from '../extension';

suite('#relativize test', function () {
    test('Root file path', function() {
        const filePath = '';
        const importPath = 'foo/bar.dart';
        const result = relativize(filePath, importPath);
        assert.equal('foo/bar.dart', result);
    });

    test('Shared root', function() {
        const filePath = 'foo';
        const importPath = 'foo/bar.dart';
        const result = relativize(filePath, importPath);
        assert.equal('bar.dart', result);
    });

    test('One up', function() {
        const filePath = 'foo';
        const importPath = 'bar.dart';
        const result = relativize(filePath, importPath);
        assert.equal('../bar.dart', result);
    });

    test('Some up', function() {
        const filePath = 'foo/bar/john/carl';
        const importPath = 'foo/bar/sam/tom.dart';
        const result = relativize(filePath, importPath);
        assert.equal('../../sam/tom.dart', result);
    });

    test('Windows - some up', function() {
        const filePath = 'foo\\bar\\john\\carl';
        const importPath = 'foo/bar/sam/tom.dart';
        const result = relativize(filePath, importPath);
        assert.equal('../../sam/tom.dart', result);
    });
});