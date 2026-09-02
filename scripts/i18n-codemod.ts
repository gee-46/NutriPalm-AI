import { Project, SyntaxKind, JsxText, StringLiteral, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const isApply = args.includes('--apply');

const project = new Project({
    tsConfigFilePath: 'tsconfig.app.json',
});

project.addSourceFilesAtPaths('src/**/*.tsx');
const sourceFiles = project.getSourceFiles();

let report = '# I18N Codemod Dry-Run Report\n\n';
let totalFound = 0;
let totalWrapped = 0;
let totalSkipped = 0;

const skipReasons: Record<string, number> = {};

function logSkip(file: string, text: string, reason: string) {
    report += `- **SKIPPED** \`${text}\` in \`${file}\`: ${reason}\n`;
    totalSkipped++;
    skipReasons[reason] = (skipReasons[reason] || 0) + 1;
}

function logWrap(file: string, text: string, key: string) {
    report += `- **WRAPPED** \`${text}\` -> \`{t('${key}')}\` in \`${file}\`\n`;
    totalWrapped++;
}

// Helper to slugify text
function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
}

const enJsonPath = 'src/translation/translations/en.json';
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

// To track new keys so we don't duplicate
const newKeys: Record<string, string> = {};

// Helper to check if a StringLiteral should be skipped based on user rules
function isSkippedUsage(node: StringLiteral): string | null {
    const parent = node.getParent();
    if (!parent) return null;

    // Skip property assignments (e.g. key: "value")
    if (Node.isPropertyAssignment(parent)) {
        return 'Property assignment';
    }

    // Check ancestors but stop if we hit a JSX element/attribute/fragment
    let current: Node | undefined = parent;
    while (current && !Node.isJsxElement(current) && !Node.isJsxFragment(current) && !Node.isJsxAttribute(current)) {
        if (Node.isBinaryExpression(current)) return 'Comparison or binary expression';
        if (Node.isCaseClause(current)) return 'Switch case';
        if (Node.isCallExpression(current)) {
            const caller = current.getExpression().getText();
            if (caller === 'changeScreen' || caller === 'setActiveScreen' || caller === 'setScreen') {
                return 'Routing/Screen change';
            }
            if (caller === 't') {
                return 'Already wrapped in t()';
            }
        }
        current = current.getParent();
    }

    return null;
}

for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    
    // Skip excluded files
    if (
        filePath.includes('LeafletMapPicker.tsx') ||
        filePath.endsWith('App.tsx') ||
        filePath.includes('/data/') ||
        filePath.includes('\\data\\')
    ) {
        continue;
    }

    const baseName = path.basename(filePath, '.tsx').toLowerCase();
    
    let fileModified = false;
    let importAdded = false;
    const componentsToInject = new Set<Node>();

    const nodesToReplace: {
    node: JsxText | StringLiteral;
    text: string;
    type: 'JsxText' | 'StringLiteral' | 'JsxAttributeValue';
    skipReason?: string;
}[] = [];

    sourceFile.forEachDescendant(node => {
        if (Node.isJsxText(node)) {
            const text = node.getLiteralText();
            if (text.trim().length > 0) {
                totalFound++;
                nodesToReplace.push({ node, text, type: 'JsxText' });
            }
        } else if (Node.isStringLiteral(node)) {
            // ONLY include string literals passed directly as JSX text children: e.g. {"Some Label"}
            const parent = node.getParent();
            if (parent && Node.isJsxExpression(parent)) {
                const grandParent = parent.getParent();
                if (grandParent && (Node.isJsxElement(grandParent) || Node.isJsxFragment(grandParent))) {
                    const text = node.getLiteralValue();
                    if (text.trim().length > 0) {
                        totalFound++;
                        const skipReason = isSkippedUsage(node);
                        nodesToReplace.push({ node, text, type: 'StringLiteral', skipReason: skipReason || undefined });
                    }
                }
            } else if (parent && Node.isJsxAttribute(parent)) {
                const attrName = parent.getNameNode().getText();
                if (['placeholder', 'aria-label', 'title', 'alt', 'label'].includes(attrName)) {
                    const text = node.getLiteralValue();
                    if (text.trim().length > 0) {
                        totalFound++;
                        const skipReason = isSkippedUsage(node);
                        // JsxAttribute value replacement needs curly braces for variable expressions
                        nodesToReplace.push({ node, text, type: 'JsxAttributeValue', skipReason: skipReason || undefined });
                    }
                }
            }
        }
    });

    if (nodesToReplace.length > 0) {
        report += `\n## File: ${baseName}.tsx\n`;
    }

    for (const item of nodesToReplace) {
        const textToTranslate = item.text.trim();
        
        if (item.skipReason) {
            logSkip(baseName, textToTranslate, item.skipReason);
            continue;
        }

        // Skip purely numeric, symbol/unit, or single character
        if (textToTranslate.length <= 1) {
            logSkip(baseName, textToTranslate, 'Single character or empty');
            continue;
        }
        
        if (/^[\d\s.,+\-%°]+$/.test(textToTranslate)) {
            logSkip(baseName, textToTranslate, 'Numeric or symbols only');
            continue;
        }
        
        if (/^\d+\s*[a-zA-Z%°/]+$/.test(textToTranslate)) { 
            logSkip(baseName, textToTranslate, 'Numeric with units');
            continue;
        }
        
        let slug = slugify(textToTranslate);
        if (!slug) {
            logSkip(baseName, textToTranslate, 'Could not generate slug');
            continue;
        }
        
        // Handle duplicate keys in the same file or collisions with existing keys
        let key = `${baseName}.${slug}`;
        let counter = 1;
        while (
            (newKeys[key] !== undefined && newKeys[key] !== textToTranslate) ||
            (enJson[key] !== undefined && enJson[key] !== textToTranslate)
        ) {
            key = `${baseName}.${slug}_${counter}`;
            counter++;
        }
        
        logWrap(baseName, textToTranslate, key);
        
        if (isApply) {
            try {
                const func = item.node.getFirstAncestor(n => Node.isFunctionDeclaration(n) || Node.isArrowFunction(n) || Node.isFunctionExpression(n));
                if (func) {
                    componentsToInject.add(func);
                }

                if (item.type === 'JsxText') {
                    const fullText = item.text;
                    const match = fullText.match(/^(\s*)(.*?)(\s*)$/s);
                    const prefix = match ? match[1] : '';
                    const suffix = match ? match[3] : '';
                    const newJsx = `${prefix}{t('${key}')}${suffix}`;
                    item.node.replaceWithText(newJsx);
                } else if (item.type === 'JsxAttributeValue') {
                    item.node.replaceWithText(`{t('${key}')}`);
                } else {
                    item.node.replaceWithText(`t('${key}')`);
                }
                newKeys[key] = textToTranslate;
                enJson[key] = textToTranslate;
                fileModified = true;
            } catch (e) {
                console.error(`Failed to replace node in ${baseName}.tsx: ${e}`);
            }
        }
    }
    
    if (isApply && fileModified) {
        for (const func of componentsToInject) {
            if (Node.hasBody(func)) {
                const block = func.getBody();
                if (Node.isBlock(block)) {
                    const text = block.getText();
                    if (!text.includes('useTranslation()')) {
                        block.insertStatements(0, 'const { t } = useTranslation();');
                    }
                }
            }
        }

        const imports = sourceFile.getImportDeclarations();
        const hasUseTranslation = imports.some(imp => imp.getNamedImports().some(ni => ni.getName() === 'useTranslation'));
        
        if (!hasUseTranslation) {
            const dir = path.dirname(filePath);
            const transDir = path.resolve('src/translation');
            let relPath = path.relative(dir, transDir).replace(/\\/g, '/');
            if (!relPath.startsWith('.')) relPath = './' + relPath;
            
            sourceFile.insertImportDeclaration(0, {
                namedImports: ['useTranslation'],
                moduleSpecifier: `${relPath}/useTranslation`
            });
            importAdded = true;
        }
        sourceFile.saveSync();
    }
}

if (isApply) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 2));
    console.log(`Applied changes and updated ${enJsonPath}`);
} else {
    let finalReport = `**Summary:**\n- Total Strings Found: ${totalFound}\n- Total Wrapped: ${totalWrapped}\n- Total Skipped: ${totalSkipped}\n\n**Skip Reasons:**\n` + 
        Object.entries(skipReasons).map(([reason, count]) => `- ${reason}: ${count}`).join('\n') + '\n\n' + report;
    
    fs.writeFileSync('scripts/i18n-codemod-report.md', finalReport);
    console.log('Dry run complete. Report saved to scripts/i18n-codemod-report.md');
}
