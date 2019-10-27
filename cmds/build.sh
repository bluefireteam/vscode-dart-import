rm -rf out *.vsix

npm run compile
npm run postinstall
npm run build:vsix
