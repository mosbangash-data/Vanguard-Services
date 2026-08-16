const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  const trips = [
    { route: 'Goma - Dar es Salaam', departure: '08:00', arrival: '18:30', seats: 18, price: 150 },
    { route: 'Goma - Bukavu', departure: '10:15', arrival: '12:00', seats: 12, price: 30 },
    { route: 'Goma - Nairobi', departure: '14:00', arrival: '22:00', seats: 7, price: 95 },
  ];

  res.render('pages/coach/index', {
    title: 'Vanguard Coach',
    user: req.session.user,
    trips,
  });
});

module.exports = router;
