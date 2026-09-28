const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname, 'src');
const buildDir = path.join(__dirname, 'build');
const distDir = path.join(__dirname, 'dist');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

function obfuscateFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const obfuscated = JavaScriptObfuscator.obfuscate(content, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75,
            simplify: true,
            shuffleStringArray: true,
            splitStrings: true,
            splitStringsChunkLength: 10,
            transformObjectKeys: true,
            unicodeEscapeSequence: true
        });
        fs.writeFileSync(filePath, obfuscated.getObfuscatedCode(), 'utf8');
        console.log(`Obfuscated: ${filePath}`);
    } catch (error) {
        console.error(`Failed to obfuscate ${filePath}:`, error);
    }
}

function obfuscateDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        
        if (fs.statSync(filePath).isDirectory()) {
            obfuscateDir(filePath);
        } else if (file.endsWith('.js')) {
            obfuscateFile(filePath);
        }
    });
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function main() {
    console.log('Starting obfuscation...');
    
    cleanDir(buildDir);
    
    copyDir(srcDir, buildDir);
    
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    packageJson.main = 'app/app.js';
    delete packageJson.build;
    delete packageJson.scripts;
    delete packageJson.devDependencies;
    fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');
    
    obfuscateDir(buildDir);
    
    console.log('Obfuscation completed.');
}

main();