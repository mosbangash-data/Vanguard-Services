const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/home', {
    title: 'Vanguard Services',
    user: req.session.user || null,
  });
});

module.exports = router;
