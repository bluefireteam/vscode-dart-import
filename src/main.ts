interface PackageInfo {
    projectRoot: string;
    projectName: string;
}

const absolutivize = (filePath: string, importPath: string, pathSep: string) => {
    const dartSep = '/'; // dart uses this separator for imports no matter the platform
    const pathSplit = (path: string, sep: string) => path.length === 0 ? [] : path.split(sep);
    const fileBits = pathSplit(filePath, pathSep);
    const importBits = pathSplit(importPath, dartSep);

    const importBitsWithoutDots = importBits.filter(x => x !== '..');

    let dotDotAmount = importBits.length - importBitsWithoutDots.length;

    if (dotDotAmount > fileBits.length) {
        dotDotAmount = fileBits.length;
    }

    const absoluteBits = fileBits.slice(0, fileBits.length - dotDotAmount).concat(importBitsWithoutDots);

    return absoluteBits.join(dartSep); 
};

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

interface EditorAccess {
    getFileName(): string;
    getLineAt(idx: number): string;
    getLineCount(): number;
    replaceLineAt(idx: number, newLine: string): Thenable<boolean>;
}

const fixImports = async (editor: EditorAccess, packageInfo: PackageInfo, pathSep: string, mode = 'relative'): Promise<number> => {
    mode = mode.toLowerCase();
    if (mode != 'absolute') mode = 'relative';
    
    const currentPath = editor.getFileName().replace(/(\/|\\)[^/\\]*.dart$/, '');
    const libFolder = `${packageInfo.projectRoot}${pathSep}lib`;
    if (!currentPath.startsWith(libFolder)) {
        const l1 = 'Current file is not on project root or not on lib folder? File must be on $root/lib.';
        const l2 = `Your current file path is: '${currentPath}' and the lib folder according to the pubspec.yaml file is '${libFolder}'.`;
        throw Error(`${l1}\n${l2}`);
    }
    const filePath = currentPath.substring(libFolder.length + 1);
    const lineCount = editor.getLineCount();
    let count = 0;
    for (let currentLine = 0; currentLine < lineCount; currentLine++) {
        const line: string = editor.getLineAt(currentLine);
        if (line.trim().length === 0) {
            continue;
        }

        if (line.trim().startsWith('//')) {
            continue;
        }

        if (line.trim().startsWith('//')) {
            continue;
        }

        const content = line.trim();
        if (!content.startsWith('import ')) {
            break;
        }

        if (mode === 'relative') {
            const packageNameRegex = new RegExp(`^\\s*import\\s*(['"])package:${packageInfo.projectName}/([^'"]*)['"]([^;]*);\\s*$`);
            const packageNameExec = packageNameRegex.exec(content);
            if (packageNameExec) {
                const quote = packageNameExec[1];
                const importPath = packageNameExec[2];
                const ending = packageNameExec[3];
                const relativePath = relativize(filePath, importPath, pathSep);
                const newContent = `import ${quote}${relativePath}${quote}${ending};`;

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
        } else {
            const packageNameRegex = new RegExp(`^\\s*import\\s*(['"])(?!${'.*'}:)([^'"]*)['"]([^;]*);\\s*$`);
            const packageNameExec = packageNameRegex.exec(content);

            if (packageNameExec) {
                const quote = packageNameExec[1];
                const importPath = packageNameExec[2];
                const ending = packageNameExec[3];

                const absolutePath = absolutivize(filePath, importPath, pathSep);
                const newContent = `import ${quote}package:${packageInfo.projectName}/${absolutePath}${quote}${ending};`;

                await editor.replaceLineAt(currentLine, newContent);
                count++;
            }
            
        }
    }
    return count;
    
};

export { PackageInfo, relativize, EditorAccess, fixImports };
