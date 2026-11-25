
  (function(){
    var report = document.getElementById('report');
    if(!report) return;
    var panel = document.createElement('div');
    panel.className = 'save-panel';
    panel.innerHTML = '<p><strong>Arsip hasil.</strong> Tombol di bawah menyimpan HASIL analisis ini (skor, vonis, dan rincian sinyal) ke arsip hasil pemilik situs sebagai catatan pemeriksaan. Isi teks/dokumen yang dianalisis <strong>tidak</strong> ikut disimpan.</p>'
      + '<button type="button" id="btn-simpan-hasil" disabled>Simpan Hasil Analisis</button><span id="simpan-status" role="status" aria-live="polite"></span>';
    report.appendChild(panel);
    var btn = document.getElementById('btn-simpan-hasil');
    var status = document.getElementById('simpan-status');
    function $(id){ return document.getElementById(id); }
    function num(id){ var el = $(id); if(!el) return null; var t = (el.textContent || '').replace('%','').trim(); var v = parseFloat(t.replace(',','.')); return isNaN(v) ? null : v; }
    function sig(){
      return [$('score-num') && $('score-num').textContent, $('st-kata') && $('st-kata').textContent, $('st-kalimat') && $('st-kalimat').textContent, $('verdict') && $('verdict').textContent].join('|');
    }
    var savedSignature = null;
    function refresh(){
      if(!report.classList.contains('show')) return;
      var done = savedSignature && savedSignature === sig();
      btn.disabled = !!done;
      if(done){ status.textContent = 'Hasil ini sudah tersimpan.'; }
      else if(status.dataset.state !== 'saving'){ status.textContent = ''; }
    }
    var mo = new MutationObserver(function(){ refresh(); });
    mo.observe(report, { attributes:true, attributeFilter:['class'] });
    var scoreEl = $('score-num');
    if(scoreEl) mo.observe(scoreEl, { childList:true, characterData:true, subtree:true });
    btn.addEventListener('click', function(){
      var fnameEl = document.querySelector('#file-status .fname');
      var eng = $('engine-line') ? $('engine-line').textContent : '';
      var mHeu = eng.match(/heuristik murni:\s*([\d.,]+)%/);
      var payload = {
        namaSumber: fnameEl ? fnameEl.textContent.trim() : 'Teks tempel / contoh uji',
        jumlahKata: num('st-kata'),
        jumlahKalimat: num('st-kalimat'),
        skorAkhir: num('score-num'),
        vonis: $('verdict') ? $('verdict').textContent.trim() : '',
        mesin: eng.trim(),
        skorHeuristik: mHeu ? parseFloat(mHeu[1].replace(',','.')) : num('score-num'),
        skorClassifier: eng.indexOf('Penguat Classifier') >= 0 ? num('pct-clf') : null,
        sinyal: {
          burstiness: num('pct-burst'), kosakata: num('pct-vocab'), frasa: num('pct-phrase'),
          stilometri: num('pct-stylo'), markdown: num('pct-md'), simetri: num('pct-sym'), pengulangan: num('pct-rep')
        }
      };
      btn.disabled = true;
      status.dataset.state = 'saving';
      status.textContent = 'Menyimpan…';
      fetch('/api/simpan-hasil', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
        .then(function(r){ return r.json().catch(function(){ return { ok:false }; }).then(function(j){ return { status:r.status, body:j }; }); })
        .then(function(out){
          status.dataset.state = '';
          if(out.body && out.body.ok){
            savedSignature = sig();
            status.textContent = '✓ Tersimpan ke arsip hasil.';
          } else {
            status.textContent = 'Gagal menyimpan: ' + ((out.body && out.body.error) || 'penyimpanan tidak tersedia pada salinan ini.');
            btn.disabled = false;
          }
        })
        .catch(function(){
          status.dataset.state = '';
          status.textContent = 'Gagal menyimpan: penyimpanan tidak tersedia pada salinan ini.';
          btn.disabled = false;
        });
    });
  })();
  