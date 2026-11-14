// Petit serveur local pour tester le site construit (dist/), comme sur GitHub Pages.
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, '..', 'dist'), { extensions: ['html'] }));
app.listen(PORT, () => console.log(`ROOOK en local : http://localhost:${PORT}`));
