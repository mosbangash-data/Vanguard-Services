document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const navLinks = document.querySelectorAll('.topnav a');

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) {
      link.style.fontWeight = '700';
      link.style.color = '#111827';
    }
  });
});
