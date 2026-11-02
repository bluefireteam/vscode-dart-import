interface PackageInfo {
    projectRoot: string;
    projectName: string;
}

const relativize = (filePath: string, importPath: string, pathSep: string) => {
    const dartSep = '/'; // dart uses this separator for imports no matter the platform
    const pathSplit = (path: string, sep: string) => path.length === 0 ? [] : path.split(sep);
    const fileBits = pathSplit(filePath, pathSep);
    const importBits = pathSplit(importPath, dartSep);
    let dotdotAmount = 0, startIdx;
    for (startIdx = 0; startIdx < fileBits.length; startIdx++) {
        if (fileBits[startIdx] === importBits[startIdx]) {
            continue;
        }
        dotdotAmount = fileBits.length - startIdx;
        break;
    }
    const relativeBits = new Array(dotdotAmount).fill('..').concat(importBits.slice(startIdx));
    return relativeBits.join(dartSep);
};

const parsePackageName = (pubspec: string): string | null => {
    const match = /^name:\s*['"]?(\w+)['"]?\s*(#.*)?$/m.exec(pubspec);
    return match ? match[1] : null;
};

const isInLib = (filePath: string, projectRoot: string, pathSep: string) => {
    return filePath.startsWith(`${projectRoot}${pathSep}lib${pathSep}`);
};

const isGeneratedFile = (filePath: string, generatedExtensions: string[]) => {
    return generatedExtensions.some((extension) => filePath.endsWith(`.${extension}`));
};

interface EditorAccess {
    getFileName(): string;
    getLineAt(idx: number): string;
    getLineCount(): number;
    replaceLineAt(idx: number, newLine: string): Thenable<boolean>;
}

// dart block comments can be nested, so we need to track how deep we are
const updateBlockCommentDepth = (line: string, depth: number) => {
    const delimiters = line.match(/\/\*|\*\//g) || [];
    return delimiters.reduce((acc, delimiter) => delimiter === '/*' ? acc + 1 : Math.max(acc - 1, 0), depth);
};

const fixImports = async (editor: EditorAccess, packageInfo: PackageInfo, pathSep: string): Promise<number> => {
    if (!isInLib(editor.getFileName(), packageInfo.projectRoot, pathSep)) {
        return 0; // files outside of lib, like tests, should keep their package imports
    }
    const currentPath = editor.getFileName().replace(/(\/|\\)[^/\\]*.dart$/, '');
    const libFolder = `${packageInfo.projectRoot}${pathSep}lib`;
    const relativePath = currentPath.substring(libFolder.length + 1);
    const lineCount = editor.getLineCount();
    let count = 0;
    let blockCommentDepth = 0;
    for (let currentLine = 0; currentLine < lineCount; currentLine++) {
        const line: string = editor.getLineAt(currentLine);
        if (line.trim().length === 0) {
            continue;
        }
        const content = line.trim();
        if (blockCommentDepth > 0 || content.startsWith('/*')) {
            blockCommentDepth = updateBlockCommentDepth(content, blockCommentDepth);
            continue;
        }
        if (content.startsWith('//') || /^library\b/.test(content)) {
            continue;
        }
        if (!content.startsWith('import ')) {
            break;
        }
        const packageNameRegex = new RegExp(`^\\s*import\\s*(['"])package:${packageInfo.projectName}/([^'"]*)['"]([^;]*);\\s*$`);
        const packageNameExec = packageNameRegex.exec(content);
        if (packageNameExec) {
            const quote = packageNameExec[1];
            const importPath = packageNameExec[2];
            const ending = packageNameExec[3];
            const relativeImport = relativize(relativePath, importPath, pathSep);
            const newContent = `import ${quote}${relativeImport}${quote}${ending};`;
            await editor.replaceLineAt(currentLine, newContent);
            count++;
        } else {
            const standardPrefixRegex = new RegExp('^\\s*import\\s*([\'"])\\./(.*)$');
            const standardPrefixExec = standardPrefixRegex.exec(content);
            if (standardPrefixExec) {
                const quote = standardPrefixExec[1];
                const end = standardPrefixExec[2];
                const newContent = `import ${quote}${end}`;
                await editor.replaceLineAt(currentLine, newContent);
                count++;
            }
        }
    }
    return count;
};

export { PackageInfo, relativize, parsePackageName, isInLib, isGeneratedFile, EditorAccess, fixImports };