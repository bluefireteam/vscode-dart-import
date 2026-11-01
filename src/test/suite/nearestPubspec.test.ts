import * as assert from 'assert';
import { nearestPubspec } from '../../main';

suite('#nearestPubspec test', () => {
    const root = { path: '/workspace/pubspec.yaml' };
    const app = { path: '/workspace/packages/app/pubspec.yaml' };
    const example = { path: '/workspace/packages/app/example/pubspec.yaml' };

    test('single pubspec', () => {
        assert.strictEqual(nearestPubspec([root]), root);
    });

    test('package inside a workspace', () => {
        assert.strictEqual(nearestPubspec([root, app]), app);
        assert.strictEqual(nearestPubspec([app, root]), app);
    });

    test('example inside a package inside a workspace', () => {
        assert.strictEqual(nearestPubspec([root, app, example]), example);
        assert.strictEqual(nearestPubspec([example, root, app]), example);
    });
});
