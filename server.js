const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('The Neuro-Sovereign server is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});