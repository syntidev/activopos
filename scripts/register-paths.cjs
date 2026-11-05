// Resuelve el alias "@/..." (-> src/...) para scripts que reutilizan código de src/lib con ts-node.
// El tsconfig raíz define "paths" sin "baseUrl" (Next lo resuelve solo); tsconfig-paths sí necesita el baseUrl.
const path = require('path')
require('tsconfig-paths').register({ baseUrl: path.join(__dirname, '..'), paths: { '@/*': ['src/*'] } })
