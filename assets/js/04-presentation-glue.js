
  /* ---------- Rombak UI/UX: lem presentasi (mode detektor, panel simpan, contoh beranda) ---------- */
  (function(){
    function setDetMode(m, scroll){
      var batch = (m === "batch");
      document.body.classList.toggle("det-batch", batch);
      var btns = document.querySelectorAll(".dm-btn");
      for(var i = 0; i < btns.length; i++){
        btns[i].setAttribute("aria-pressed", (btns[i].getAttribute("data-dmode") === m) ? "true" : "false");
      }
      if(scroll){
        var t = document.getElementById(batch ? "batch" : "analisis");
        if(t) t.scrollIntoView();
      }
    }
    document.addEventListener("click", function(e){
      var b = (e.target && e.target.closest) ? e.target.closest(".dm-btn") : null;
      if(!b) return;
      setDetMode(b.getAttribute("data-dmode"), true);
    });
    function detModeFromHash(){
      var h = window.location.hash || "";
      if(h === "#batch"){ setDetMode("batch", false); }
      else if(h === "#/detector" || h === "#analisis" || h === "#report" || h === "#clf-panel" || h === "#panel-analisis"){ setDetMode("single", false); }
    }
    window.addEventListener("hashchange", detModeFromHash);
    detModeFromHash();
    /* Panel "Simpan Hasil Analisis" (disuntikkan skrip arsip) dipindah ke kartu skor
       agar tiga tindakan utama berkumpul di blok ringkasan hasil. */
    var sc = document.querySelector(".score-card");
    var sp = document.querySelector(".save-panel");
    if(sc && sp) sc.appendChild(sp);
    /* "Coba Contoh Teks" di beranda: pakai alur contoh detektor yang sudah ada persis. */
    var ex = document.getElementById("p7-quick-example");
    if(ex) ex.addEventListener("click", function(){
      function go(){ var b = document.getElementById("ex1"); if(b) b.click(); }
      if((window.location.hash || "") === "#/detector"){ go(); }
      else { window.location.hash = "#/detector"; setTimeout(go, 350); }
    });
  })();
  