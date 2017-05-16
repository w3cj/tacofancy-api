const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/layers.json');
});

app.use((req, res, next) => {
  res.status(404);
  next(new Error('🌮 These are not the layers are looking for. 🌮'))
});

app.use((error, req, res, next) => {
  res.status(res.statusCode || 500);
  res.json({
    message: error.message || '🌮'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
