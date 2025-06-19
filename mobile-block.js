// Block mobile devices and show a message
(function() {
  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Tablet|tablet/i.test(navigator.userAgent);
  }
  if (isMobile()) {
    document.body.innerHTML = '<div id="mobile-block-message" style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;width:100vw;background:#15695a;color:#fff;font-family:Sk-Modernist,Helvetica,sans-serif;text-align:center;padding:2rem;"><h2 style="font-size:2rem;margin-bottom:1.5rem;">QWERT Synth is an easy to play instrument through your keyboard, however it only works on Desktop/Laptops for now.</h2><p style="font-size:1.2rem;max-width:500px;">Load this website on your Laptop browser and enjoy!</p></div>';
    document.body.style.overflow = 'hidden';
  }
})();
