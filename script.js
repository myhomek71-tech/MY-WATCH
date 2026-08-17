(function(){
  const canvas = document.getElementById('scrubCanvas');
  const ctx = canvas.getContext('2d');
  const track = document.getElementById('scrubTrack');
  const totalFrames = FRAME_DATA.length;
  const images = new Array(totalFrames);
  let loadedCount = 0;

  function sizeCanvas(){
    canvas.width = window.innerWidth * (window.devicePixelRatio > 1 ? 1.4 : 1);
    canvas.height = window.innerHeight * (window.devicePixelRatio > 1 ? 1.4 : 1);
  }
  sizeCanvas();

  function drawFrame(idx){
    const img = images[idx];
    if(!img || !img.complete || img.naturalWidth === 0) return;
    const cw = canvas.width, ch = canvas.height;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = cw / ch;
    let dw, dh, dx, dy;
    if(ir > cr){
      dh = ch; dw = ch * ir; dx = (cw - dw)/2; dy = 0;
    } else {
      dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh)/2;
    }
    ctx.clearRect(0,0,cw,ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Load first frame immediately, then the rest
  function loadAll(){
    for(let i=0;i<totalFrames;i++){
      const img = new Image();
      img.onload = function(){
        loadedCount++;
        if(i === 0) drawFrame(0);
      };
      img.src = FRAME_DATA[i];
      images[i] = img;
    }
  }
  loadAll();

  const copyEls = [
    document.getElementById('copy1'),
    document.getElementById('copy2'),
    document.getElementById('copy3'),
    document.getElementById('copy4')
  ];
  const scrollCue = document.getElementById('scrollCue');
  const bezel = document.getElementById('bezel');
  const bezelLabel = document.getElementById('bezelLabel');

  // Build bezel tick marks (60, watch-bezel style)
  const bezelSvg = document.getElementById('bezelSvg');
  const TICKS = 60;
  const cx = 50, cy = 50, rOuter = 47, rInner = 40, rInnerMajor = 36;
  let tickEls = [];
  for(let i=0;i<TICKS;i++){
    const angle = (i / TICKS) * Math.PI * 2 - Math.PI/2;
    const major = i % 5 === 0;
    const rI = major ? rInnerMajor : rInner;
    const x1 = cx + rOuter * Math.cos(angle);
    const y1 = cy + rOuter * Math.sin(angle);
    const x2 = cx + rI * Math.cos(angle);
    const y2 = cy + rI * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
    line.setAttribute('class', 'bezel-tick');
    bezelSvg.appendChild(line);
    tickEls.push(line);
  }

  function updateBezel(progress){
    const lit = Math.round(progress * TICKS);
    for(let i=0;i<TICKS;i++){
      tickEls[i].classList.toggle('lit', i < lit);
    }
    const pct = Math.round(progress * 100);
    bezelLabel.textContent = String(pct).padStart(2,'0');
  }

  function setCopyVisibility(progress){
    // 4 copy blocks across the scroll range, each visible in its own band
    const bands = [
      [0.00, 0.16, 0.24],
      [0.28, 0.42, 0.50],
      [0.55, 0.68, 0.76],
      [0.82, 0.94, 1.0]
    ];
    copyEls.forEach((el, i) => {
      const [inStart, hold, outEnd] = bands[i];
      let opacity = 0;
      if(i === 0 && progress <= hold){
        // first block is fully visible from the very start of the scroll
        opacity = 1;
      } else if(progress >= inStart && progress <= outEnd){
        if(progress < hold){
          opacity = (progress - inStart) / (hold - inStart);
        } else {
          opacity = 1 - (progress - hold) / (outEnd - hold);
        }
      }
      opacity = Math.max(0, Math.min(1, opacity));
      el.style.opacity = opacity;
    });
  }

  let ticking = false;
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const rect = track.getBoundingClientRect();
      const trackHeight = track.offsetHeight - window.innerHeight;
      let progress = -rect.top / trackHeight;
      progress = Math.max(0, Math.min(1, progress));

      const frameIdx = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
      drawFrame(frameIdx);
      setCopyVisibility(progress);
      updateBezel(progress);

      bezel.classList.toggle('visible', progress > 0.01 && progress < 0.995);
      scrollCue.style.opacity = progress > 0.03 ? 0 : 1;

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', () => { sizeCanvas(); onScroll(); });
  onScroll();

  // Reveal-on-scroll for content sections
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.15});
  revealEls.forEach(el => io.observe(el));

  // Gallery images from the frame sequence
  document.querySelectorAll('.gallery-item[data-frame]').forEach(el => {
    const idx = parseInt(el.getAttribute('data-frame'), 10);
    const img = el.querySelector('img');
    if(FRAME_DATA[idx]) img.src = FRAME_DATA[idx];
  });
})();
