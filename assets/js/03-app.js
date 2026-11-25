
    // PWA: daftarkan service worker cangkang aplikasi (sw.js) — hanya di http(s).
    if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
      window.addEventListener("load", function(){
        navigator.serviceWorker.register("/sw.js").catch(function(){ /* situs tetap berfungsi tanpa SW */ });
      });
    }
    // Modal Catatan Rilis (footer).
    (function(){
      var dlg = document.getElementById("changelog-modal");
      var open = document.getElementById("btn-changelog");
      var close = document.getElementById("changelog-close");
      if(!dlg || !open) return;
      open.addEventListener("click", function(){
        if(typeof dlg.showModal === "function") dlg.showModal();
        else dlg.setAttribute("open", "");
      });
      if(close) close.addEventListener("click", function(){ dlg.close(); });
      dlg.addEventListener("click", function(ev){ if(ev.target === dlg) dlg.close(); });
    })();
    /* ================= Writing Forensic (Phase 3) =================
       Modul statistik karakteristik tulisan. Berdiri sendiri: TIDAK memakai
       skor detector dan TIDAK memengaruhi detector. */
    /* WF-CORE-START — fungsi murni (tanpa DOM), dapat diekstrak & diuji terpisah. */
    var WF_STOPWORDS = { "yang":1,"dan":1,"di":1,"ke":1,"dari":1,"untuk":1,"dengan":1,"pada":1,"dalam":1,"adalah":1,"ini":1,"itu":1,"atau":1,"juga":1,"tidak":1,"akan":1,"telah":1,"oleh":1,"sebagai":1,"karena":1,"sehingga":1,"tetapi":1,"namun":1,"agar":1,"bagi":1,"para":1,"sangat":1,"lebih":1,"dapat":1,"bisa":1,"ada":1,"saya":1,"kami":1,"kita":1,"anda":1,"dia":1,"mereka":1,"ia":1,"saat":1,"ketika":1,"jika":1,"maka":1,"seperti":1,"antara":1,"atas":1,"bawah":1,"sudah":1,"belum":1,"harus":1,"hanya":1,"saja":1,"pun":1,"bahwa":1,"tentang":1,"tanpa":1,"setelah":1,"sebelum":1,"hingga":1,"sampai":1,"selama":1,"melalui":1,"terhadap":1,"kepada":1,"bukan":1,"jangan":1,"sedang":1,"masih":1,"pernah":1,"serta":1,"maupun":1,"ataupun":1,"yaitu":1,"yakni":1,"setiap":1,"semua":1,"banyak":1,"beberapa":1,"satu":1,"dua":1,"tiga":1,"empat":1,"lima":1,"enam":1,"tujuh":1,"delapan":1,"sembilan":1,"sepuluh":1,"pertama":1,"kedua":1,"lain":1,"sama":1,"sendiri":1,"begitu":1,"demikian":1,"sebab":1,"meski":1,"meskipun":1,"walaupun":1,"bahkan":1,"justru":1,"malah":1,"hendak":1,"ingin":1,"perlu":1,"mungkin":1,"tentu":1,"pasti":1,"memang":1,"sebenarnya":1 };
    var WF_TRANSITIONS = ["selain itu","di sisi lain","oleh karena itu","oleh sebab itu","dengan demikian","meskipun demikian","pada akhirnya","sebagai contoh","antara lain","secara umum","secara khusus","dalam hal ini","sementara itu","dapat disimpulkan","berdasarkan hal tersebut","kesimpulannya","namun","tetapi","bahkan","justru","sebaliknya","misalnya","selanjutnya","kemudian","akhirnya","pertama","kedua","ketiga","akibatnya","jadi","sementara"];
    var WF_SUBORDINATORS = { "karena":1,"sehingga":1,"ketika":1,"jika":1,"apabila":1,"bahwa":1,"meskipun":1,"walaupun":1,"agar":1,"supaya":1,"setelah":1,"sebelum":1,"saat":1,"hingga":1,"sambil":1,"meski":1 };
    function wfMean(a){ if(!a.length) return 0; var s=0; for(var i=0;i<a.length;i++) s+=a[i]; return s/a.length; }
    function wfMedian(a){ if(!a.length) return 0; var b=a.slice().sort(function(x,y){ return x-y; }); var m=Math.floor(b.length/2); return b.length%2 ? b[m] : (b[m-1]+b[m])/2; }
    function wfSd(a){ if(a.length<2) return 0; var m=wfMean(a), s=0; for(var i=0;i<a.length;i++) s+=(a[i]-m)*(a[i]-m); return Math.sqrt(s/(a.length-1)); }
    function wfCv(a){ var m=wfMean(a); return m>0 ? wfSd(a)/m : 0; }
    function wfFreq(tokens){ var f=Object.create(null); for(var i=0;i<tokens.length;i++) f[tokens[i]]=(f[tokens[i]]||0)+1; return f; }
    function wfCountPhrases(tokens, phrases){
      var matches=[], used=Object.create(null), out=Object.create(null);
      phrases.forEach(function(p){
        var pt=p.split(" "), n=pt.length;
        for(var i=0;i+n<=tokens.length;i++){
          var ok=true;
          for(var j=0;j<n;j++){ if(tokens[i+j]!==pt[j]){ ok=false; break; } }
          if(ok) matches.push({ p:p, start:i, end:i+n });
        }
      });
      matches.sort(function(a,b){ return (b.end-b.start)-(a.end-a.start) || a.start-b.start; });
      matches.forEach(function(m){
        var k;
        for(k=m.start;k<m.end;k++){ if(used[k]) return; }
        for(k=m.start;k<m.end;k++) used[k]=1;
        out[m.p]=(out[m.p]||0)+1;
      });
      return out;
    }
    function wfAnalyze(text){
      var words = wordsOf(text);
      var W = words.length;
      if(W === 0) return { empty: true };
      var parasRaw = splitParagraphs(text);
      if(parasRaw.length === 0) parasRaw = [text];
      var paraData = [], allLens = [];
      parasRaw.forEach(function(p){
        var sents = splitSentences(p);
        var pw = wordsOf(p);
        var lens = sents.map(function(s){ return wordsOf(s).length; });
        for(var i=0;i<lens.length;i++) allLens.push(lens[i]);
        paraData.push({ words: pw, sents: sents, lens: lens });
      });
      var S = allLens.length, k, w2;
      var freq = wfFreq(words), U = Object.keys(freq).length, hapax = 0;
      for(k in freq){ if(freq[k]===1) hapax++; }
      var winTtr = [];
      for(var i=0;i+50<=W;i+=50){ var wf2=Object.create(null); for(var j=i;j<i+50;j++) wf2[words[j]]=1; winTtr.push(Object.keys(wf2).length/50); }
      var buckets = [0,0,0,0,0,0,0];
      allLens.forEach(function(L){ buckets[L<=5?0 : L<=10?1 : L<=15?2 : L<=20?3 : L<=25?4 : L<=30?5 : 6]++; });
      var commaCount = (text.match(/,/g) || []).length;
      var subHits = 0, sentsWithSub = 0;
      paraData.forEach(function(pd){ pd.sents.forEach(function(s){ var ws=wordsOf(s), has=false; ws.forEach(function(w){ if(WF_SUBORDINATORS[w]){ subHits++; has=true; } }); if(has) sentsWithSub++; }); });
      var longSents = 0;
      allLens.forEach(function(L){ if(L>25) longSents++; });
      var paraWords = paraData.map(function(pd){ return pd.words.length; });
      var paraSents = paraData.map(function(pd){ return pd.sents.length; });
      var transCounts = wfCountPhrases(words, WF_TRANSITIONS);
      var transTotal = 0, transList = [];
      for(k in transCounts){ transTotal += transCounts[k]; transList.push({ p:k, c:transCounts[k] }); }
      transList.sort(function(a,b){ return b.c-a.c || (a.p<b.p ? -1 : 1); });
      var content = [];
      for(w2 in freq){ if(!WF_STOPWORDS[w2] && !/^\d+$/.test(w2)) content.push({ w:w2, c:freq[w2] }); }
      content.sort(function(a,b){ return b.c-a.c || (a.w<b.w ? -1 : 1); });
      var grams = Object.create(null);
      for(var g=0; g+4<=W; g++){ var key = words.slice(g, g+4).join(" "); grams[key]=(grams[key]||0)+1; }
      var gramList = [];
      for(k in grams){ if(grams[k]>=2) gramList.push({ g:k, c:grams[k] }); }
      gramList.sort(function(a,b){ return b.c-a.c || (a.g<b.g ? -1 : 1); });
      var starters = Object.create(null);
      paraData.forEach(function(pd){ pd.sents.forEach(function(s){ var ws=wordsOf(s); if(ws.length>=2){ var st=ws[0]+" "+ws[1]; starters[st]=(starters[st]||0)+1; } }); });
      var starterList = [];
      for(k in starters){ if(starters[k]>=2) starterList.push({ s:k, c:starters[k] }); }
      starterList.sort(function(a,b){ return b.c-a.c || (a.s<b.s ? -1 : 1); });
      var styleParas = [];
      paraData.forEach(function(pd, idx){
        if(pd.words.length >= 15 && pd.lens.length >= 1){
          var pf = wfFreq(pd.words), pu = Object.keys(pf).length;
          var pt = wfCountPhrases(pd.words, WF_TRANSITIONS), ptt = 0;
          for(var q in pt) ptt += pt[q];
          styleParas.push({ idx: idx+1, words: pd.words.length, avgLen: wfMean(pd.lens), ttr: pd.words.length ? pu/pd.words.length : 0, trans: pd.words.length ? ptt/pd.words.length*100 : 0 });
        }
      });
      var cons = { n: styleParas.length, cvLen: 0, cvTtr: 0, outliers: [] };
      if(styleParas.length >= 2){
        cons.cvLen = wfCv(styleParas.map(function(p){ return p.avgLen; }));
        cons.cvTtr = wfCv(styleParas.map(function(p){ return p.ttr; }));
      }
      if(styleParas.length >= 4){
        var lensArr = styleParas.map(function(p){ return p.avgLen; });
        var mL = wfMean(lensArr), sL = wfSd(lensArr);
        if(sL > 0) styleParas.forEach(function(p){ var z=(p.avgLen-mL)/sL; if(Math.abs(z) >= 1.75) cons.outliers.push({ idx:p.idx, avgLen:p.avgLen, mean:mL, z:z }); });
      }
      return {
        empty: false, words: W, unique: U, ttr: U/W, ttrWin: winTtr.length ? wfMean(winTtr) : U/W,
        hapax: hapax, guiraud: U/Math.sqrt(W),
        sents: S, lensMean: wfMean(allLens), lensMedian: wfMedian(allLens), lensSd: wfSd(allLens), lensCv: wfCv(allLens),
        buckets: buckets, bucketLabels: ["1–5","6–10","11–15","16–20","21–25","26–30",">30"],
        commasPerSent: S ? commaCount/S : 0, subPerSent: S ? subHits/S : 0,
        subSentPct: S ? sentsWithSub/S : 0, longSentPct: S ? longSents/S : 0,
        paras: parasRaw.length, paraWordsMean: wfMean(paraWords), paraWordsCv: wfCv(paraWords),
        paraWordsMin: Math.min.apply(null, paraWords), paraWordsMax: Math.max.apply(null, paraWords),
        paraSentsMean: wfMean(paraSents),
        paraRows: paraData.map(function(pd){ return { words: pd.words.length, sents: pd.sents.length, avgLen: wfMean(pd.lens) }; }),
        transTotal: transTotal, transPer100: transTotal/W*100, transList: transList.slice(0,10),
        topContent: content.slice(0,10), topGrams: gramList.slice(0,8), starters: starterList.slice(0,5),
        styleParas: styleParas, cons: cons, shortText: W < 300
      };
    }
    /* WF-CORE-END */

    /* Writing Forensic — render & interaksi (DOM). */
    function wfFmt(x, d){ return x.toFixed(d === undefined ? 1 : d).replace(".", ","); }
    function wfPctTxt(x, d){ return wfFmt(x*100, d === undefined ? 1 : d) + "%"; }
    function wfRhythmLabel(cv){ return cv < 0.35 ? "seragam" : (cv <= 0.6 ? "sedang" : "bervariasi"); }
    function wfTable(rows){
      var h = "<table class=\"wf-table\"><tbody>";
      rows.forEach(function(r){ h += "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>"; });
      return h + "</tbody></table>";
    }
    function wfRender(st, displayText){
      var cards = [
        [fmtNumID(st.words), "total kata"],
        [fmtNumID(st.sents), "kalimat"],
        [fmtNumID(st.paras), "paragraf"],
        [fmtNumID(st.unique), "kata unik"],
        [wfPctTxt(st.ttr), "TTR — unik ÷ total"],
        [wfPctTxt(st.ttrWin), "TTR jendela 50 kata"],
        [wfFmt(st.lensMean), "rata-rata kata per kalimat"],
        [wfFmt(st.transPer100, 2), "transisi per 100 kata"]
      ];
      $("wf-cards").innerHTML = cards.map(function(c){ return "<div class=\"wf-card\"><div class=\"n\">" + c[0] + "</div><div class=\"t\">" + c[1] + "</div></div>"; }).join("");

      var maxB = Math.max.apply(null, st.buckets.concat([1]));
      $("wf-chart").innerHTML = st.buckets.map(function(c, i){
        var pctv = st.sents ? c/st.sents*100 : 0;
        return "<div class=\"wf-bar-row\"><span>" + st.bucketLabels[i] + " kata</span><span class=\"wf-bar\"><span class=\"wf-bar-fill\" style=\"display:block; width:" + (c/maxB*100).toFixed(1) + "%\"></span></span><span>" + c + " kalimat (" + wfFmt(pctv) + "%)</span></div>";
      }).join("");

      $("wf-lex").innerHTML = wfTable([
        ["TTR keseluruhan (unik ÷ total)", wfPctTxt(st.ttr)],
        ["TTR jendela 50 kata (rata-rata)", wfPctTxt(st.ttrWin)],
        ["Kata unik", fmtNumID(st.unique)],
        ["Kata hapax — muncul tepat sekali", fmtNumID(st.hapax) + " (" + wfPctTxt(st.unique ? st.hapax/st.unique : 0) + " dari kata unik)"],
        ["Indeks Guiraud (unik ÷ √total)", wfFmt(st.guiraud)]
      ]) + "<p class=\"wf-note\">TTR selalu turun pada teks yang lebih panjang, jadi TTR jendela dan Guiraud disertakan agar perbandingan antar teks lebih adil. Tanpa stemming, kata berimbuhan dihitung berbeda — angka Bahasa Indonesia cenderung terlihat lebih tinggi. Keragaman yang rendah <strong>bukan</strong> bukti AI.</p>";

      $("wf-cplx").innerHTML = wfTable([
        ["Rata-rata kata per kalimat", wfFmt(st.lensMean)],
        ["Median kata per kalimat", wfFmt(st.lensMedian)],
        ["Simpangan baku panjang kalimat", wfFmt(st.lensSd)],
        ["CV ritme (SD ÷ rata-rata)", wfFmt(st.lensCv, 2) + " — " + wfRhythmLabel(st.lensCv)],
        ["Koma per kalimat (proksi klausa)", wfFmt(st.commasPerSent, 2)],
        ["Penanda subordinasi per kalimat", wfFmt(st.subPerSent, 2)],
        ["Kalimat berpenanda subordinasi", wfPctTxt(st.subSentPct)],
        ["Kalimat panjang (&gt;25 kata)", wfPctTxt(st.longSentPct)]
      ]) + "<p class=\"wf-note\">Label ritme memakai ambang deskriptif: CV &lt;0,35 = seragam; 0,35–0,60 = sedang; &gt;0,60 = bervariasi. Penanda subordinasi yang dihitung: karena, sehingga, ketika, jika, apabila, bahwa, meskipun, walaupun, agar, supaya, setelah, sebelum, saat, hingga, sambil, meski.</p>";

      var paraRows = st.paraRows.slice(0, 30).map(function(p, i){
        return ["Paragraf " + (i+1), p.words + " kata · " + p.sents + " kalimat · rata-rata " + wfFmt(p.avgLen) + " kata/kalimat"];
      });
      $("wf-para").innerHTML = wfTable([
        ["Jumlah paragraf", fmtNumID(st.paras)],
        ["Rata-rata kata per paragraf", wfFmt(st.paraWordsMean)],
        ["CV panjang paragraf", wfFmt(st.paraWordsCv, 2)],
        ["Paragraf terpendek / terpanjang", st.paraWordsMin + " / " + st.paraWordsMax + " kata"],
        ["Rata-rata kalimat per paragraf", wfFmt(st.paraSentsMean)]
      ]) + (st.paras > 1 ? wfTable(paraRows) : "") +
      (st.paras > 30 ? "<p class=\"wf-note\">Rincian menampilkan 30 paragraf pertama; statistik di atas mencakup seluruh teks.</p>" : "");

      if(st.transList.length){
        $("wf-trans").innerHTML = "<p>Total <strong>" + st.transTotal + " kata transisi</strong> ditemukan (" + wfFmt(st.transPer100, 2) + " per 100 kata) dari kamus ±31 penanda:</p>" +
          wfTable(st.transList.map(function(t){ return ["“" + escapeHtml(t.p) + "”", t.c + "×"]; }));
      } else {
        $("wf-trans").innerHTML = "<p>Tidak ditemukan kata transisi dari kamus (±31 penanda) pada teks ini. Alur antar kalimat bertumpu pada urutan isi, bukan penanda eksplisit.</p>";
      }

      var repHtml = "";
      if(st.topContent.length){
        repHtml += "<p><strong>Kata isi tersering</strong> (di luar kata fungsi):</p>" + wfTable(st.topContent.map(function(c){ return ["“" + escapeHtml(c.w) + "”", c.c + "× · " + wfPctTxt(c.c/st.words) + " dari teks"]; }));
      }
      if(st.topGrams.length){
        repHtml += "<p style=\"margin-top:12px;\"><strong>Rangkaian 4 kata yang berulang</strong> (≥2 kali):</p>" + wfTable(st.topGrams.map(function(g){ return ["“" + escapeHtml(g.g) + "”", g.c + "×"]; }));
      } else {
        repHtml += "<p style=\"margin-top:12px;\">Tidak ada rangkaian 4 kata yang muncul ≥2 kali pada teks ini.</p>";
      }
      if(st.starters.length){
        repHtml += "<p style=\"margin-top:12px;\"><strong>Awalan kalimat yang berulang</strong> (2 kata pertama):</p>" + wfTable(st.starters.map(function(s){ return ["“" + escapeHtml(s.s) + " …”", s.c + " kalimat"]; }));
      }
      $("wf-rep").innerHTML = repHtml;

      var consHtml = "";
      if(st.cons.n < 2){
        consHtml = "<p>Belum cukup paragraf yang memenuhi syarat perbandingan (minimal 2 paragraf berisi ≥15 kata" + (st.cons.n < 4 ? "; penandaan paragraf menyimpang membutuhkan ≥4 paragraf" : "") + "). Teks ini memiliki " + st.cons.n + " paragraf yang memenuhi syarat.</p>";
      } else {
        consHtml = wfTable([
          ["Paragraf yang dibandingkan", fmtNumID(st.cons.n) + " paragraf (≥15 kata)"],
          ["CV rata-rata panjang kalimat antarparagraf", wfFmt(st.cons.cvLen, 2)],
          ["CV TTR antarparagraf", wfFmt(st.cons.cvTtr, 2)]
        ]);
        if(st.cons.n >= 4){
          if(st.cons.outliers.length){
            consHtml += "<p style=\"margin-top:10px;\"><strong>Paragraf yang menyimpang</strong> (rata-rata panjang kalimat berjarak ≥1,75 simpangan baku dari rata-rata antarparagraf):</p>" + wfTable(st.cons.outliers.map(function(o){ return ["Paragraf " + o.idx, "rata-rata " + wfFmt(o.avgLen) + " kata/kalimat · rata-rata antarparagraf " + wfFmt(o.mean) + " · z = " + (o.z >= 0 ? "+" : "−") + wfFmt(Math.abs(o.z), 2)]; }));
          } else {
            consHtml += "<p style=\"margin-top:10px;\">Tidak ada paragraf yang menyimpang ≥1,75 simpangan baku menurut aturan ini.</p>";
          }
        } else {
          consHtml += "<p class=\"wf-note\">Penandaan paragraf menyimpang membutuhkan ≥4 paragraf yang memenuhi syarat; saat ini " + st.cons.n + ".</p>";
        }
        consHtml += "<p class=\"wf-note\">Penyimpangan dapat disebabkan perbedaan topik atau struktur (misalnya pendahuluan vs daftar) — ini bukan bukti perbedaan penulis.</p>";
      }
      $("wf-cons").innerHTML = consHtml;

      $("wf-summary").innerHTML = "<p>Teks ini terdiri dari <strong>" + fmtNumID(st.words) + " kata</strong> dalam <strong>" + fmtNumID(st.sents) + " kalimat</strong> dan <strong>" + fmtNumID(st.paras) + " paragraf</strong>. Panjang kalimat rata-rata " + wfFmt(st.lensMean) + " kata (median " + wfFmt(st.lensMedian) + ") dengan CV " + wfFmt(st.lensCv, 2) + " — ritme tergolong <strong>" + wfRhythmLabel(st.lensCv) + "</strong> menurut ambang deskriptif di panel kompleksitas. Keragaman kosakata: TTR " + wfPctTxt(st.ttr) + " (TTR jendela " + wfPctTxt(st.ttrWin) + ", Guiraud " + wfFmt(st.guiraud) + "). Kata transisi ditemukan " + st.transTotal + " kali (" + wfFmt(st.transPer100, 2) + " per 100 kata)" + (st.topContent.length ? "; kata isi tersering adalah “" + escapeHtml(st.topContent[0].w) + "” (" + st.topContent[0].c + "×)" : "") + (st.topGrams.length ? "; terdapat " + st.topGrams.length + " rangkaian 4 kata yang berulang" : "; tidak ada rangkaian 4 kata yang berulang") + ". Semua angka ini adalah deskripsi karakteristik teks — bukan penilaian asal-usulnya.</p>";

      var sug = [];
      if(st.lensCv < 0.35 && st.sents >= 8) sug.push("Ritme kalimat seragam (CV " + wfFmt(st.lensCv, 2) + " &lt; 0,35): pertimbangkan memecah satu-dua kalimat panjang atau menggabungkan kalimat-kalimat pendek agar ritme lebih hidup — isi tidak perlu diubah.");
      if(st.topContent.length && st.topContent[0].c >= 8 && st.topContent[0].c/st.words >= 0.02) sug.push("Kata “" + escapeHtml(st.topContent[0].w) + "” muncul " + st.topContent[0].c + " kali (" + wfPctTxt(st.topContent[0].c/st.words) + " dari teks): bila konteksnya memungkinkan, variasikan dengan sinonim atau kata rujukan agar tidak monoton.");
      if(st.topGrams.length) sug.push("Rangkaian “" + escapeHtml(st.topGrams[0].g) + "” berulang " + st.topGrams[0].c + " kali: pertimbangkan menulis ulang salah satu kemunculannya dengan redaksi berbeda, tanpa mengubah maksud.");
      if(st.transPer100 > 4) sug.push("Kata transisi sangat rapat (" + wfFmt(st.transPer100, 2) + " per 100 kata): sebagian penanda di awal kalimat biasanya dapat dihilangkan tanpa mengubah makna, bila kalimatnya sudah mengalir.");
      if(st.transTotal === 0 && st.paras >= 3) sug.push("Tidak ditemukan kata transisi eksplisit pada teks " + st.paras + " paragraf ini: menambah penanda transisi di awal beberapa paragraf dapat membantu pembaca mengikuti alur.");
      if(st.longSentPct > 0.25 && st.sents >= 8) sug.push("Kalimat panjang (&gt;25 kata) mencapai " + wfPctTxt(st.longSentPct) + " dari seluruh kalimat: memecah kalimat-kalimat terpanjang biasanya menaikkan keterbacaan tanpa mengubah isi.");
      if(st.paraWordsCv > 0.8 && st.paras >= 3) sug.push("Panjang paragraf sangat bervariasi (CV " + wfFmt(st.paraWordsCv, 2) + "): periksa paragraf terpanjang (" + st.paraWordsMax + " kata) — barangkali memuat dua gagasan yang lebih nyaman dipisah.");
      if(st.starters.length && st.starters[0].c >= 4) sug.push("Awalan kalimat “" + escapeHtml(st.starters[0].s) + " …” dipakai " + st.starters[0].c + " kali: memvariasikan awalan (subjek, waktu, tempat, sebab) membuat pola kalimat terasa lebih beragam.");
      $("wf-suggest").innerHTML = sug.length ? "<ul class=\"wf-suggest\">" + sug.map(function(s){ return "<li>" + s + "</li>"; }).join("") + "</ul>" : "<p>Tidak ada pola mencolok yang terdeteksi oleh aturan penyuntingan sederhana ini pada teks ini.</p>";

      /* Sorotan: bangun dari token kata teks tampilan (maks 6.000 kata pertama). */
      var wordSet = Object.create(null);
      st.topContent.forEach(function(c){ if(c.c >= 4) wordSet[c.w] = 1; });
      var re = /[\p{L}\p{N}']+/gu, m, toks = [];
      while((m = re.exec(displayText)) !== null){ toks.push({ s: m.index, e: m.index + m[0].length, low: m[0].toLowerCase() }); if(toks.length >= 6000) break; }
      var inPhrase = Object.create(null);
      var gramKeys = Object.create(null);
      st.topGrams.forEach(function(g){ gramKeys[g.g] = 1; });
      for(var gi = 0; gi + 4 <= toks.length; gi++){
        var key4 = toks[gi].low + " " + toks[gi+1].low + " " + toks[gi+2].low + " " + toks[gi+3].low;
        if(gramKeys[key4]){ for(var gj = gi; gj < gi+4; gj++) inPhrase[gj] = 1; }
      }
      var html = "", pos = 0;
      toks.forEach(function(t, i){
        html += escapeHtml(displayText.slice(pos, t.s));
        var wtxt = escapeHtml(displayText.slice(t.s, t.e));
        if(inPhrase[i]) html += "<mark class=\"wf-p\">" + wtxt + "</mark>";
        else if(wordSet[t.low]) html += "<mark class=\"wf-w\">" + wtxt + "</mark>";
        else html += wtxt;
        pos = t.e;
      });
      var truncated = wordsOf(displayText).length > toks.length;
      if(!truncated) html += escapeHtml(displayText.slice(pos));
      $("wf-hl").innerHTML = html || "<span class=\"wf-note\">Tidak ada teks untuk disorot.</span>";
      $("wf-hl-note").textContent = truncated ? "Sorotan menampilkan 6.000 kata pertama; seluruh statistik di atas mencakup teks yang dianalisis." : (st.topGrams.length || Object.keys(wordSet).length ? "" : "Tidak ada kata isi yang muncul ≥4 kali dan tidak ada frasa berulang, jadi tidak ada yang disorot.");
    }

    var wfTa = $("wf-input");
    function wfUpdateCounters(){
      var t = wfTa.value;
      $("wf-cnt-kata").textContent = fmtNumID(wordsOf(t).length);
      $("wf-cnt-kalimat").textContent = fmtNumID(t.trim() ? splitSentences(t).length : 0);
      $("wf-cnt-paragraf").textContent = fmtNumID(t.trim() ? splitParagraphs(t).length : 0);
    }
    function wfShowError(msg){
      var b = $("wf-error");
      if(msg){ b.innerHTML = msg; b.classList.add("show"); }
      else { b.innerHTML = ""; b.classList.remove("show"); }
    }
    function wfFileStatus(html, kind){
      var el = $("wf-file-status");
      el.innerHTML = html;
      el.className = "file-status show" + (kind ? " " + kind : "");
    }
    function wfRun(){
      var raw = wfTa.value;
      wfShowError("");
      if(!raw.trim()){ wfShowError("<strong>Kotak teks masih kosong.</strong> Tempel teks, unggah berkas, atau klik salah satu contoh uji terlebih dahulu."); return; }
      var btn = $("wf-btn");
      btn.disabled = true;
      btn.textContent = "Menganalisis…";
      setTimeout(function(){
        try {
          var cap = capAnalysisText(raw);
          var st = wfAnalyze(cap.text);
          if(st.empty){ wfShowError("<strong>Tidak ada kata yang terbaca dari teks ini.</strong> Periksa kembali isinya — mungkin hanya berisi simbol atau angka acak."); return; }
          var res = $("wf-results");
          res.hidden = false;
          var notes = [];
          if(cap.capped) notes.push("Dokumen ini berisi " + fmtNumID(cap.totalWords) + " kata; sesuai batas per dokumen, yang dianalisis adalah " + fmtNumID(MAX_ANALYZE_WORDS) + " kata pertamanya.");
          if(st.shortText) notes.push("<strong>Teks pendek (" + fmtNumID(st.words) + " kata):</strong> di bawah ±300 kata, statistik mudah berayun oleh beberapa kalimat — perlakukan hasil ini sebagai gambaran kasar.");
          var sb = $("wf-short");
          if(notes.length){ sb.innerHTML = notes.join(" "); sb.classList.add("show"); }
          else { sb.innerHTML = ""; sb.classList.remove("show"); }
          wfRender(st, cap.text);
          p7WfFriendly(st);
          wfLastRun = { st: st, text: cap.text };
          histSave("forensik", histTitleOf(cap.text), { words: st.words, ttrPct: (st.lex && typeof st.lex.ttr === "number") ? Math.round(st.lex.ttr * 1000) / 10 : null, sentences: st.sent ? st.sent.count : null }, cap.text);
          res.scrollIntoView({ behavior: "smooth", block: "start" });
        } finally {
          btn.disabled = false;
          btn.textContent = "Analisis Karakteristik";
        }
      }, 30);
    }
    function wfHandleFile(f){
      if(!f) return;
      if(typeof f.size === "number" && f.size > MAX_FILE_BYTES){
        wfFileStatus("<strong>Berkas terlalu besar</strong> (" + (f.size/1048576).toFixed(1).replace(".", ",") + " MB) — batasnya 20 MB. Kecilkan berkasnya, atau tempel teksnya langsung.", "err");
        return;
      }
      var lower = (f.name || "").toLowerCase();
      if(lower.endsWith(".doc") && !lower.endsWith(".docx")){
        wfFileStatus("<strong>Format .doc lama tidak didukung</strong> — simpan ulang sebagai .docx, lalu unggah lagi.", "err");
        return;
      }
      var kind = null;
      if(lower.endsWith(".docx")) kind = "docx";
      else if(lower.endsWith(".pdf")) kind = "pdf";
      else if(lower.endsWith(".txt") || f.type === "text/plain") kind = "txt";
      else { wfFileStatus("<strong>Format berkas belum didukung.</strong> Yang bisa diunggah: .txt, .docx, dan .pdf.", "err"); return; }
      wfFileStatus("Membaca berkas <span class=\"fname\">" + escapeHtml(f.name) + "</span>…", "");
      var p = kind === "txt" ? f.text() : f.arrayBuffer().then(kind === "docx" ? extractDocxText : extractPdfText);
      p.then(function(text){
        text = String(text || "");
        var wc = wordsOf(text).length;
        if(kind === "pdf" && (wc < 30 || looksGarbled(text))){
          ocrPendingFile = f;
          wfFileStatus("<strong>Teks dari PDF ini tidak terbaca</strong> — kemungkinan PDF hasil pindai/gambar (butuh OCR) atau font-nya tidak standar. Salin-tempel teksnya langsung ke kotak di atas, atau <button type=\"button\" class=\"btn-ghost\" data-ocr-open=\"1\">Buka di OCR</button>", "err");
          return;
        }
        if(!text.trim() || wc === 0){
          wfFileStatus("<strong>Tidak ada teks yang bisa dibaca dari berkas ini.</strong>", "err");
          return;
        }
        wfTa.value = text;
        wfUpdateCounters();
        wfFileStatus("Berkas dimuat: <span class=\"fname\">" + escapeHtml(f.name) + "</span> — " + fmtNumID(wc) + " kata terbaca.", "ok");
        wfRun();
      }).catch(function(){
        wfFileStatus("<strong>Berkas tidak bisa dibaca.</strong> Pastikan formatnya benar dan berkas tidak rusak, atau salin-tempel teksnya langsung.", "err");
      });
    }
    if(wfTa){
      wfTa.addEventListener("input", wfUpdateCounters);
      $("wf-btn").addEventListener("click", wfRun);
      $("wf-clear").addEventListener("click", function(){
        wfTa.value = "";
        wfUpdateCounters();
        wfShowError("");
        $("wf-file-status").innerHTML = "";
        $("wf-file-status").className = "file-status";
        $("wf-results").hidden = true;
        wfTa.focus();
      });
      $("wf-file").addEventListener("change", function(ev){
        if(ev.target.files && ev.target.files[0]) wfHandleFile(ev.target.files[0]);
        ev.target.value = "";
      });
      $("wf-ex1").addEventListener("click", function(){ wfTa.value = CONTOH_MANUSIA; wfUpdateCounters(); wfRun(); });
      $("wf-ex2").addEventListener("click", function(){ wfTa.value = CONTOH_AI; wfUpdateCounters(); wfRun(); });
      wfUpdateCounters();
    }

    /* ================= Writing Intelligence (Phase 8.1) =================
       Asisten Menulis: saran perbaikan mekanis yang deterministik. Berdiri
       sendiri: TIDAK memakai skor detector, TIDAK mengubah teks asli tanpa
       persetujuan pengguna, dan TIDAK menyimpan teks di mana pun. */
    /* WI-CORE-START — fungsi murni (tanpa DOM), dapat diekstrak & diuji terpisah. */
    var WI_MAX_CHARS = 50000;
    var WI_ABBR = { "dll":1, "dsb":1, "dst":1, "dr":1, "drs":1, "dra":1, "prof":1, "no":1, "hal":1, "thn":1, "vs":1, "rp":1, "sbb":1, "yth":1, "sc":1, "si":1, "pd":1, "kom":1, "sos":1, "hum":1, "ked":1, "kes":1, "psi":1, "ag":1, "tek":1, "ling":1, "fil":1, "phd":1, "hlm":1, "dkk":1, "pkl":1, "tgl":1, "vol":1, "tbk":1 };
    /* ---------- Phase 8.2: Grammar & Spelling Checker ----------
       Semua daftar di bawah adalah daftar tertutup hasil kurasi yang sengaja
       konservatif: lebih baik melewatkan kata yang meragukan daripada
       menandai kata yang benar. */
    // Pasangan baku/tidak baku merujuk EYD V dan KBBI; hanya pasangan yang tidak diperdebatkan.
    var WI_BAKU = { "praktek": "praktik", "apotik": "apotek", "jaman": "zaman", "nasehat": "nasihat", "menasehati": "menasihati", "resiko": "risiko", "sistim": "sistem", "tehnik": "teknik", "kwalitas": "kualitas", "kwalitatif": "kualitatif", "kwantitatif": "kuantitatif", "ijin": "izin", "hutang": "utang", "silahkan": "silakan", "antri": "antre", "mengantri": "mengantre", "coklat": "cokelat", "detil": "detail", "formil": "formal", "karir": "karier", "komplit": "komplet", "lembab": "lembap", "menejemen": "manajemen", "nopember": "november", "obyek": "objek", "obyekif": "objektif", "obyektif": "objektif", "analisa": "analisis", "menganalisa": "menganalisis", "atlit": "atlet", "azas": "asas", "faham": "paham", "fikir": "pikir", "berfikir": "berpikir", "frekwensi": "frekuensi", "hakekat": "hakikat", "jadual": "jadwal", "jendral": "jenderal", "kreatifitas": "kreativitas", "efektifitas": "efektivitas", "produktifitas": "produktivitas", "metoda": "metode", "musium": "museum", "nafas": "napas", "bernafas": "bernapas", "personil": "personel", "propinsi": "provinsi", "rapih": "rapi", "rejeki": "rezeki", "sekedar": "sekadar", "supir": "sopir", "telpon": "telepon", "menelpon": "menelepon", "ummat": "umat", "ustad": "ustaz", "massalah": "masalah", "menggangu": "mengganggu", "mempesona": "mempesona", "menyolok": "mencolok", "aktifitas": "aktivitas", "ekstrim": "ekstrem", "konkrit": "konkret", "negatip": "negatif", "positip": "positif", "aktip": "aktif", "pasip": "pasif", "subyek": "subjek", "subyektif": "subjektif", "hirarki": "hierarki", "cendikiawan": "cendekiawan", "diagnosa": "diagnosis", "fotocopy": "fotokopi", "kaos": "kaus", "kadaluarsa": "kedaluwarsa", "komersil": "komersial", "kwitansi": "kuitansi", "legalisir": "legalisasi", "mantera": "mantra", "prosentase": "persentase", "realita": "realitas", "rematik": "reumatik", "syaraf": "saraf", "seprei": "seprai", "sovenir": "suvenir", "tarip": "tarif", "tentram": "tenteram", "trampil": "terampil", "tradisionil": "tradisional", "difinisi": "definisi", "disain": "desain", "diskripsi": "deskripsi", "mendiskripsikan": "mendeskripsikan", "ekivalen": "ekuivalen", "frustasi": "frustrasi", "hapal": "hafal", "himbau": "imbau", "justeru": "justru", "kuatir": "khawatir", "kordinasi": "koordinasi", "kuisioner": "kuesioner", "lobang": "lubang", "prilaku": "perilaku" };
    // Pasangan ragam cakapan: ditandai sebagai "saran", bukan kesalahan pasti.
    var WI_BAKU_SARAN = { "pinter": "pintar", "karna": "karena", "ketawa": "tertawa" };
    // Kata depan yang lazim tertulis serangkai padahal harus terpisah.
    var WI_DEPAN_TETAP = { "dimana": "di mana", "kemana": "ke mana", "diantara": "di antara", "diatas": "di atas", "dibawah": "di bawah", "didalam": "di dalam", "diluar": "di luar", "didepan": "di depan", "dibelakang": "di belakang", "disamping": "di samping", "disini": "di sini", "disana": "di sana", "disitu": "di situ", "kesini": "ke sini", "kesana": "ke sana", "kesitu": "ke situ", "kebawah": "ke bawah", "keatas": "ke atas", "kedalam": "ke dalam", "kebelakang": "ke belakang", "kesamping": "ke samping" };
    // Kata benda penunjuk tempat untuk pola "di/ke + tempat" yang tertulis serangkai.
    var WI_TEMPAT = { "rumah":1, "sekolah":1, "kantor":1, "kampus":1, "kelas":1, "jalan":1, "pasar":1, "kota":1, "desa":1, "kampung":1, "dapur":1, "kamar":1, "ruang":1, "ruangan":1, "gedung":1, "toko":1, "warung":1, "masjid":1, "gereja":1, "universitas":1, "fakultas":1, "perpustakaan":1, "lapangan":1, "halaman":1, "taman":1, "pantai":1, "gunung":1, "sungai":1, "danau":1, "laut":1, "pulau":1, "bandara":1, "stasiun":1, "terminal":1, "pelabuhan":1, "hotel":1, "restoran":1, "bank":1, "meja":1, "kursi":1 };
    // Kata kerja lazim untuk pola "di " + verba yang seharusnya serangkai (pasif).
    var WI_VERBA = { "makan":1, "minum":1, "baca":1, "tulis":1, "ambil":1, "beri":1, "berikan":1, "buat":1, "lakukan":1, "gunakan":1, "pakai":1, "sebut":1, "sebutkan":1, "jelaskan":1, "tunjukkan":1, "sampaikan":1, "dapatkan":1, "peroleh":1, "lihat":1, "dengar":1, "dengarkan":1, "kerjakan":1, "pelajari":1, "ajarkan":1, "mulai":1, "selesaikan":1, "bantu":1, "dukung":1, "pilih":1, "tentukan":1, "tetapkan":1, "hasilkan":1, "ciptakan":1, "kembangkan":1, "tingkatkan":1, "turunkan":1, "naikkan":1, "simpan":1, "kirim":1, "terima":1, "tolak":1, "jual":1, "beli":1, "bayar":1, "hitung":1, "ukur":1, "amati":1, "analisis":1, "uji":1, "periksa":1, "catat":1, "buka":1, "tutup":1, "ajukan":1, "usulkan":1, "bahas":1, "diskusikan":1, "presentasikan":1, "publikasikan":1, "daftarkan":1, "umumkan":1, "laksanakan":1, "terapkan":1, "jalankan":1, "hentikan":1, "lanjutkan":1, "pahami":1, "ketahui":1, "miliki":1, "perlukan":1 };
    // Kata ganti + "pun" yang harus terpisah, dan kata hubung serangkai yang TIDAK pernah ditandai.
    var WI_PUN_MAP = { "apapun": "apa pun", "siapapun": "siapa pun", "manapun": "mana pun", "bagaimanapun": "bagaimana pun", "kapanpun": "kapan pun", "berapapun": "berapa pun" };
    var WI_PUN_NEVER = { "walaupun":1, "meskipun":1, "sekalipun":1, "sungguhpun":1, "kalaupun":1 };
    // Kata ulang baku yang lazim tertulis dua kata: kata dasar -> bentuk berhubung.
    var WI_ULANG_MAP = { "hati": "hati-hati", "baik": "baik-baik", "pelan": "pelan-pelan", "kadang": "kadang-kadang", "masing": "masing-masing", "lain": "lain-lain", "anak": "anak-anak", "buku": "buku-buku", "orang": "orang-orang", "ibu": "ibu-ibu", "bapak": "bapak-bapak", "teman": "teman-teman", "rumah": "rumah-rumah", "pohon": "pohon-pohon", "sehari": "sehari-hari" };
    // Bentuk gabungan yang salah dan harus dipisah.
    var WI_PISAH_MAP = { "terimakasih": "terima kasih", "trimakasih": "terima kasih" };
    var WI_ORDINAL = { "dua":1, "tiga":1, "empat":1, "lima":1, "enam":1, "tujuh":1, "delapan":1, "sembilan":1, "sepuluh":1, "sebelas":1 };
    var WI_MECH_NEVER = { "allah":1 };
    function wiQuoteSpans(p){
      var spans = [], open = -1, openS = -1, openA = -1;
      for(var i=0;i<p.length;i++){
        var c = p.charAt(i);
        if(c === "“"){ if(open < 0) open = i; }
        else if(c === "”"){ if(open >= 0){ spans.push([open, i]); open = -1; } }
        else if(c === "\""){ if(open < 0) open = i; else { spans.push([open, i]); open = -1; } }
        else if(c === "‘"){ if(openS < 0) openS = i; }
        else if(c === "’"){ if(openS >= 0){ spans.push([openS, i]); openS = -1; } }
        else if(c === "'"){
          // Kutip tunggal lurus hanya diakui sebagai pembatas bila berdiri di
          // tepi kata: pembuka didahului awal/spasi/tanda buka dan diikuti
          // huruf; penutup didahului huruf/tanda baca dan diikuti spasi/tanda
          // baca/akhir. Apostrof di tengah kata (Jum'at) tidak pernah membuka.
          var pv = i > 0 ? p.charAt(i-1) : "";
          var nx = i + 1 < p.length ? p.charAt(i+1) : "";
          if(openA < 0 && (i === 0 || /[\s(\[{“‘"—–-]/.test(pv)) && /\p{L}/u.test(nx)) openA = i;
          else if(openA >= 0 && /[\p{L}.!?…,;:]/u.test(pv) && (nx === "" || /[\s)\]}"”’.,;:!?]/.test(nx))){ spans.push([openA, i]); openA = -1; }
        }
      }
      if(open >= 0) spans.push([open, p.length - 1]);
      if(openS >= 0) spans.push([openS, p.length - 1]);
      // openA yang tak berpasangan dibuang (bukan diperpanjang): kutip tunggal
      // lurus terlalu mudah tertukar dengan apostrof liar.
      return spans;
    }
    function wiInSpans(spans, pos){
      if(!spans) return false;
      for(var i=0;i<spans.length;i++){ if(pos >= spans[i][0] && pos <= spans[i][1]) return true; }
      return false;
    }
    // Konteks yang tidak boleh ditandai: URL/domain/email (satu gugus tanpa spasi bertitik internal).
    function wiBadCtx(p, start, end){
      var a = start; while(a > 0 && !/\s/.test(p.charAt(a-1))) a--;
      var b = end; while(b < p.length && !/\s/.test(p.charAt(b))) b++;
      var chunk = p.slice(a, b);
      if(chunk.indexOf("://") >= 0 || chunk.indexOf("@") >= 0) return true;
      chunk = chunk.replace(/[.!?,;:]+$/, "");
      for(var i=1;i<chunk.length-1;i++){
        if(chunk.charAt(i) === "." && /[\p{L}\p{N}]/u.test(chunk.charAt(i-1)) && /[\p{L}]/u.test(chunk.charAt(i+1))) return true;
      }
      return false;
    }
    // Gugus singkatan bertitik (s.d., a.n., u.p.): huruf tunggal berurutan yang
    // dipisah titik — titik terakhir gugus itu bukan akhir kalimat.
    function wiAbbrCluster(p, idx){
      return /(?:^|\s)(?:\p{L}\.)*\p{L}$/u.test(p.slice(0, idx));
    }
    function wiSentenceStart(p, pos){
      var i = pos - 1, moved = true;
      while(moved && i >= 0){
        moved = false;
        while(i >= 0 && /[ \t]/.test(p.charAt(i))){ i--; moved = true; }
        while(i >= 0 && /["'“”‘’«»(\[]/.test(p.charAt(i))){ i--; moved = true; }
      }
      if(i < 0) return true;
      var c = p.charAt(i);
      if(c === "\n") return true;
      if(/[.!?…]/.test(c)){
        var wb = (p.slice(0, i).match(/[\p{L}]+$/u) || [""])[0];
        return !(wb && WI_ABBR[wb.toLowerCase()]) && !wiAbbrCluster(p, i);
      }
      return false;
    }
    function wiMatchCase(repl, cap){ return cap ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl; }
    // Penjaga bersama aturan berbasis kamus. Mengembalikan { cap } bila token aman
    // ditandai, null bila tidak (angka, HURUF BESAR semua, kapital internal, di dalam
    // kutip, bagian URL/domain, kapital tengah kalimat, atau frasa nama diri).
    function wiDictFire(p, toks, i, ctx){
      var tok = toks[i], t = tok.t;
      if(/\d/.test(t)) return null;
      if(t.length > 1 && t === t.toUpperCase() && t !== t.toLowerCase()) return null;
      if(/[\p{Lu}]/u.test(t.slice(1))) return null;
      if(ctx && wiInSpans(ctx.quotes, tok.start)) return null;
      if(wiBadCtx(p, tok.start, tok.end)) return null;
      if(!/[\p{Lu}]/u.test(t.charAt(0))) return { cap: false };
      if(!wiSentenceStart(p, tok.start)) return null;
      var nx = toks[i+1];
      if(nx && /[\p{Lu}]/u.test(nx.t.charAt(0)) && !/[.!?…]/.test(p.slice(tok.end, nx.start))) return null;
      return { cap: true };
    }
    function wiSplitParas(text){
      var parts = String(text).split(/(\n[ \t]*\n(?:[ \t]*\n)*)/);
      var paras = [], seps = [];
      for(var i=0;i<parts.length;i++){ if(i%2===0) paras.push(parts[i]); else seps.push(parts[i]); }
      return { paras: paras, seps: seps };
    }
    function wiTokens(p){
      var toks = [], re = /[\p{L}\p{N}]+/gu, m;
      while((m = re.exec(p)) !== null){ toks.push({ t: m[0], start: m.index, end: m.index + m[0].length }); }
      return toks;
    }
    function wiRuleRepeated(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      for(var i=1;i<toks.length;i++){
        var prev = toks[i-1], cur = toks[i];
        if(prev.t.toLowerCase() !== cur.t.toLowerCase()) continue;
        if(/[.!?…]/.test(p.slice(prev.end, cur.start))) continue;
        // Pasangan yang disambung tanda hubung adalah kata ulang yang sah
        // (sungguh-sungguh, benar-benar) — ejaan bakunya memang demikian.
        if(p.slice(prev.end, cur.start).indexOf("-") >= 0) continue;
        // Di dalam kutip, teks direproduksi apa adanya — tidak ditandai.
        if(ctx && (wiInSpans(ctx.quotes, prev.start) || wiInSpans(ctx.quotes, cur.start))) continue;
        out.push({ kind: "repeated-word", pIdx: pIdx, start: prev.start, end: cur.end, original: p.slice(prev.start, cur.end), replacement: prev.t, explanation: "Kata yang sama muncul dua kali berturut-turut — kemungkinan salah ketik. Usulan menghapus pengulangan kedua.", certainty: "pasti", prio: 0 });
      }
    }
    function wiRuleSpaces(p, pIdx, out){
      var m, re = /[ \t]+(?=[.,!?;:])/g;
      while((m = re.exec(p)) !== null){
        var s = m.index, e = s + m[0].length, punct = p.charAt(e);
        if(s === 0 || p.charAt(s-1) === "\n") continue;
        if(punct === "." && p.charAt(e+1) === ".") continue;
        if(/\d/.test(p.charAt(e+1))) continue;
        out.push({ kind: "double-space", pIdx: pIdx, start: s, end: e+1, original: p.slice(s, e+1), replacement: punct, explanation: "Ada spasi sebelum tanda baca — tanda baca seharusnya menempel pada kata sebelumnya.", certainty: "pasti", prio: 1 });
      }
      var re2 = /[ \t]{2,}/g;
      while((m = re2.exec(p)) !== null){
        var s2 = m.index, e2 = s2 + m[0].length;
        if(s2 === 0 || e2 >= p.length) continue;
        if(p.charAt(s2-1) === "\n" || p.charAt(e2) === "\n") continue;
        out.push({ kind: "double-space", pIdx: pIdx, start: s2, end: e2, original: m[0], replacement: " ", explanation: "Ada lebih dari satu spasi berturut-turut di tengah kalimat — dirapikan menjadi satu spasi.", certainty: "pasti", prio: 2 });
      }
    }
    function wiRuleMissingSpace(p, pIdx, out){
      var re = /[.!?]/g, m;
      while((m = re.exec(p)) !== null){
        var i = m.index, before = p.charAt(i-1), after = p.charAt(i+1);
        if(!before || !after) continue;
        if(!/[\p{L}]/u.test(before) || !/[\p{Lu}]/u.test(after)) continue;
        var nb = p.charAt(i+2);
        if(nb === "." || nb === "!" || nb === "?") continue;
        var ls = i; while(ls > 0 && !/\s/.test(p.charAt(ls-1))) ls--;
        var rs = i+1; while(rs < p.length && !/\s/.test(p.charAt(rs))) rs++;
        if((p.slice(ls, rs).split(/[.!?]/).length - 1) > 1) continue;
        var wb = (p.slice(0, i).match(/[\p{L}]+$/u) || [""])[0];
        if(wb.length < 2 || WI_ABBR[wb.toLowerCase()]) continue;
        out.push({ kind: "missing-space-after-punctuation", pIdx: pIdx, start: i, end: i+1, original: p.charAt(i), replacement: p.charAt(i) + " ", explanation: "Tidak ada spasi setelah tanda baca, sehingga kalimat berikutnya menempel — usulan menambahkan satu spasi.", certainty: "pasti", prio: 1 });
      }
    }
    function wiRuleCapital(p, pIdx, out){
      var lead = p.replace(/^\s+/, "");
      if(/^([-*•·]|\d+[.)])\s/.test(lead)) return;
      if(p.indexOf("://") >= 0) return;
      var starts = [{ pos: 0, wb: null, digitBefore: false, punct: -1 }];
      var re = /[.!?…]+[ \t]+/g, m;
      while((m = re.exec(p)) !== null){
        var wb = (p.slice(0, m.index).match(/[\p{L}]+$/u) || [""])[0];
        starts.push({ pos: m.index + m[0].length, wb: wb, digitBefore: /\d/.test(p.charAt(m.index - 1)), punct: m.index });
      }
      starts.forEach(function(st){
        if(st.wb && WI_ABBR[st.wb.toLowerCase()]) return;
        if(st.punct >= 0 && wiAbbrCluster(p, st.punct)) return;
        if(st.digitBefore) return;
        var i = st.pos;
        while(i < p.length && /[ \t]/.test(p.charAt(i))) i++;
        while(i < p.length && /["'“”‘’«»(\[]/.test(p.charAt(i))) i++;
        if(i >= p.length) return;
        var ch = p.charAt(i);
        if(!/[\p{Ll}]/u.test(ch)) return;
        out.push({ kind: "sentence-capital", pIdx: pIdx, start: i, end: i+1, original: ch, replacement: ch.toUpperCase(), explanation: "Kalimat diawali huruf kecil — usulan mengubah huruf pertamanya menjadi huruf kapital.", certainty: "pasti", prio: 3 });
      });
    }
    function wiRuleUlang(p, pIdx, out, ctx){
      var m, reH = /([\p{L}]+)[ \t]+-[ \t]+([\p{L}]+)/gu;
      while((m = reH.exec(p)) !== null){
        if(m[1].toLowerCase() !== m[2].toLowerCase()) continue;
        out.push({ kind: "kata-ulang", pIdx: pIdx, start: m.index, end: m.index + m[0].length, original: m[0], replacement: m[1] + "-" + m[2].toLowerCase(), explanation: "Kata ulang ditulis dengan tanda hubung tanpa spasi: “" + m[1].toLowerCase() + "-" + m[2].toLowerCase() + "”.", certainty: "pasti", prio: 0 });
      }
      var toks = wiTokens(p);
      for(var i=0;i<toks.length;i++){
        var tok = toks[i], mm = /^([\p{L}]+)2$/u.exec(tok.t);
        if(!mm || mm[1].length < 3) continue;
        if(/[\p{Lu}]/u.test(mm[1].slice(1))) continue;
        if(mm[1].length > 1 && mm[1] === mm[1].toUpperCase()) continue;
        if(ctx && wiInSpans(ctx.quotes, tok.start)) continue;
        if(wiBadCtx(p, tok.start, tok.end)) continue;
        out.push({ kind: "kata-ulang", pIdx: pIdx, start: tok.start, end: tok.end, original: tok.t, replacement: mm[1] + "-" + mm[1].toLowerCase(), explanation: "Angka 2 di akhir kata adalah cara singkat menulis kata ulang — dalam tulisan formal tuliskan bentuk lengkapnya dengan tanda hubung: “" + mm[1].toLowerCase() + "-" + mm[1].toLowerCase() + "”.", certainty: "saran", prio: 5 });
      }
      for(var j=1;j<toks.length;j++){
        var prev = toks[j-1], cur = toks[j], low = cur.t.toLowerCase();
        if(prev.t.toLowerCase() !== low || !WI_ULANG_MAP[low]) continue;
        if(/[.!?…]/.test(p.slice(prev.end, cur.start))) continue;
        // Sudah disambung tanda hubung = ejaan yang benar; jangan buat saran
        // yang usulannya sama persis dengan teks aslinya.
        if(p.slice(prev.end, cur.start).indexOf("-") >= 0) continue;
        out.push({ kind: "kata-ulang", pIdx: pIdx, start: prev.start, end: cur.end, original: p.slice(prev.start, cur.end), replacement: wiMatchCase(WI_ULANG_MAP[low], /[\p{Lu}]/u.test(prev.t.charAt(0))), explanation: "“" + WI_ULANG_MAP[low] + "” adalah kata ulang dan ditulis dengan tanda hubung, bukan sebagai dua kata terpisah.", certainty: "pasti", prio: 0 });
      }
    }
    function wiRuleBaku(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      for(var i=0;i<toks.length;i++){
        var low = toks[i].t.toLowerCase(), std = WI_BAKU[low], cert = "pasti";
        if(!std){ std = WI_BAKU_SARAN[low]; cert = "saran"; }
        if(!std) continue;
        if(ctx && ctx.ignore && ctx.ignore[low]) continue;
        var hit = wiDictFire(p, toks, i, ctx);
        if(!hit) continue;
        out.push({ kind: "kata-tidak-baku", pIdx: pIdx, start: toks[i].start, end: toks[i].end, original: toks[i].t, replacement: wiMatchCase(std, hit.cap), explanation: cert === "pasti" ? "Kata tidak baku menurut EYD V/KBBI — bentuk bakunya adalah “" + std + "”." : "Kata ini termasuk ragam cakapan — dalam tulisan formal bentuk bakunya adalah “" + std + "”.", certainty: cert, prio: 4, word: low });
      }
    }
    function wiRuleDepan(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      for(var i=0;i<toks.length;i++){
        var tok = toks[i], low = tok.t.toLowerCase(), fixed = WI_DEPAN_TETAP[low];
        if(fixed){
          if(ctx && ctx.ignore && ctx.ignore[low]) continue;
          var hitF = wiDictFire(p, toks, i, ctx);
          if(hitF) out.push({ kind: "kata-depan", pIdx: pIdx, start: tok.start, end: tok.end, original: tok.t, replacement: wiMatchCase(fixed, hitF.cap), explanation: "Kata depan ditulis terpisah dari kata yang mengikutinya — “" + fixed + "” adalah penulisan yang baku.", certainty: "pasti", prio: 4, word: low });
          continue;
        }
        if(tok.t !== low || /\d/.test(tok.t)) continue;
        var pre = null, noun = null;
        if(low.indexOf("di") === 0 && WI_TEMPAT[low.slice(2)]){ pre = "di"; noun = low.slice(2); }
        else if(low.indexOf("ke") === 0 && WI_TEMPAT[low.slice(2)]){ pre = "ke"; noun = low.slice(2); }
        if(!pre) continue;
        if(ctx && wiInSpans(ctx.quotes, tok.start)) continue;
        if(wiBadCtx(p, tok.start, tok.end)) continue;
        out.push({ kind: "kata-depan", pIdx: pIdx, start: tok.start, end: tok.end, original: tok.t, replacement: pre + " " + noun, explanation: "“" + pre + "” di sini adalah kata depan penunjuk tempat, sehingga ditulis terpisah: “" + pre + " " + noun + "”.", certainty: "pasti", prio: 4 });
      }
    }
    function wiRuleImbuhan(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      for(var i=0;i<toks.length;i++){
        var tok = toks[i], low = tok.t.toLowerCase();
        if(WI_PUN_MAP[low] && !WI_PUN_NEVER[low]){
          var hitP = wiDictFire(p, toks, i, ctx);
          if(hitP) out.push({ kind: "imbuhan", pIdx: pIdx, start: tok.start, end: tok.end, original: tok.t, replacement: wiMatchCase(WI_PUN_MAP[low], hitP.cap), explanation: "Partikel “pun” pada kata ganti ditulis terpisah: “" + WI_PUN_MAP[low] + "”. (Berbeda dengan kata hubung seperti walaupun dan meskipun yang memang ditulis serangkai.)", certainty: "pasti", prio: 4 });
          continue;
        }
        if((low === "di" || low === "ke") && i + 1 < toks.length){
          var nx = toks[i+1];
          if(!/^[ \t]+$/.test(p.slice(tok.end, nx.start))) continue;
          if(ctx && wiInSpans(ctx.quotes, tok.start)) continue;
          var nlow = nx.t.toLowerCase();
          if(low === "di" && nx.t === nlow && WI_VERBA[nlow]){
            out.push({ kind: "imbuhan", pIdx: pIdx, start: tok.start, end: nx.end, original: p.slice(tok.start, nx.end), replacement: (/[\p{Lu}]/u.test(tok.t.charAt(0)) ? "Di" : "di") + nlow, explanation: "“di-” di sini adalah awalan (imbuhan) pembentuk kata kerja pasif, sehingga ditulis serangkai dengan kata kerjanya: “di" + nlow + "”.", certainty: "pasti", prio: 4 });
          } else if(low === "ke" && nx.t === nlow && WI_ORDINAL[nlow]){
            var after = toks[i+2];
            if(after && after.t.toLowerCase() === "belas") continue;
            out.push({ kind: "imbuhan", pIdx: pIdx, start: tok.start, end: nx.end, original: p.slice(tok.start, nx.end), replacement: (/[\p{Lu}]/u.test(tok.t.charAt(0)) ? "Ke" : "ke") + nlow, explanation: "Bila maksudnya bilangan tingkat (urutan), “ke-” ditulis serangkai: “ke" + nlow + "”. Bila maksudnya “menuju " + nlow + " …”, penulisan terpisah yang benar — putuskan sesuai maksud kalimat Anda.", certainty: "saran", prio: 5 });
          }
        }
      }
    }
    function wiRulePemisahan(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      for(var i=0;i<toks.length;i++){
        var tok = toks[i], low = tok.t.toLowerCase();
        if(WI_PISAH_MAP[low]){
          if(ctx && ctx.ignore && ctx.ignore[low]) continue;
          var hit = wiDictFire(p, toks, i, ctx);
          if(hit) out.push({ kind: "pemisahan-kata", pIdx: pIdx, start: tok.start, end: tok.end, original: tok.t, replacement: wiMatchCase(WI_PISAH_MAP[low], hit.cap), explanation: "“Terima kasih” ditulis terpisah sebagai dua kata.", certainty: "pasti", prio: 4, word: low });
          continue;
        }
        if(low === "apa" && i + 1 < toks.length && toks[i+1].t.toLowerCase() === "bila"){
          var nx2 = toks[i+1];
          if(!/^[ \t]+$/.test(p.slice(tok.end, nx2.start))) continue;
          if(ctx && ctx.ignore && ctx.ignore["apabila"]) continue;
          if(ctx && wiInSpans(ctx.quotes, tok.start)) continue;
          out.push({ kind: "pemisahan-kata", pIdx: pIdx, start: tok.start, end: nx2.end, original: p.slice(tok.start, nx2.end), replacement: /[\p{Lu}]/u.test(tok.t.charAt(0)) ? "Apabila" : "apabila", explanation: "Kata hubung “apabila” ditulis serangkai sebagai satu kata. Abaikan bila “apa bila” memang Anda maksudkan sebagai frasa tanya.", certainty: "saran", prio: 5, word: "apabila" });
        }
      }
    }
    function wiRulePunct2(p, pIdx, out, ctx){
      var m;
      var reC = /([\p{L}])(,)([\p{L}])/gu;
      while((m = reC.exec(p)) !== null){
        var ci = m.index + m[1].length;
        if(wiBadCtx(p, ci, ci + 1)) continue;
        out.push({ kind: "tanda-baca", pIdx: pIdx, start: ci, end: ci + 1, original: ",", replacement: ", ", explanation: "Tidak ada spasi setelah koma — usulan menambahkan satu spasi agar kalimat mudah dibaca.", certainty: "pasti", prio: 1 });
      }
      var reCC = /,{2,}/g;
      while((m = reCC.exec(p)) !== null){
        if(wiBadCtx(p, m.index, m.index + m[0].length)) continue;
        out.push({ kind: "tanda-baca", pIdx: pIdx, start: m.index, end: m.index + m[0].length, original: m[0], replacement: ",", explanation: "Koma tertulis berurutan — cukup satu koma.", certainty: "pasti", prio: 1 });
      }
      var reBang = /([!?])[!?]+/g;
      while((m = reBang.exec(p)) !== null){
        if(wiBadCtx(p, m.index, m.index + m[0].length)) continue;
        out.push({ kind: "tanda-baca", pIdx: pIdx, start: m.index, end: m.index + m[0].length, original: m[0], replacement: m[1], explanation: "Tanda baca berurutan (" + m[0] + ") — dalam tulisan formal cukup satu tanda. Abaikan bila penekanan ini memang disengaja.", certainty: "saran", prio: 5 });
      }
      var reDots = /(?<!\.)\.\.(?!\.)/g;
      while((m = reDots.exec(p)) !== null){
        if(/\d/.test(p.charAt(m.index - 1)) || /\d/.test(p.charAt(m.index + 2))) continue;
        if(wiBadCtx(p, m.index, m.index + 2)) continue;
        out.push({ kind: "tanda-baca", pIdx: pIdx, start: m.index, end: m.index + 2, original: "..", replacement: "…", explanation: "Dua titik berturut-turut — bila maksudnya elipsis (jeda atau kelanjutan), gunakan tanda elipsis “…”. Abaikan bila bukan.", certainty: "saran", prio: 5 });
      }
    }
    function wiRuleCapitalSaya(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      var trimmed = p.replace(/[\s"“”]+$/, "");
      if(!/[.!?…]$/.test(trimmed) && toks.length < 8) return;
      for(var i=0;i<toks.length;i++){
        if(toks[i].t !== "Saya") continue;
        if(ctx && wiInSpans(ctx.quotes, toks[i].start)) continue;
        if(wiSentenceStart(p, toks[i].start)) continue;
        out.push({ kind: "huruf-kapital", pIdx: pIdx, start: toks[i].start, end: toks[i].end, original: "Saya", replacement: "saya", explanation: "Menurut EYD, kata ganti “saya” ditulis dengan huruf kecil di tengah kalimat; huruf kapital hanya dipakai di awal kalimat.", certainty: "saran", prio: 5 });
      }
    }
    function wiRuleEjaan(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      for(var i=0;i<toks.length;i++){
        var tok = toks[i], t = tok.t;
        if(/\d/.test(t)) continue;
        if(t.length > 1 && t === t.toUpperCase() && t !== t.toLowerCase()) continue;
        if(/[\p{Lu}]/u.test(t.slice(1))) continue;
        if(WI_MECH_NEVER[t.toLowerCase()]) continue;
        if(ctx && wiInSpans(ctx.quotes, tok.start)) continue;
        if(wiBadCtx(p, tok.start, tok.end)) continue;
        if(!/(\p{L})\1{2,}/u.test(t)) continue;
        var repl = t.replace(/(\p{L})\1{2,}/gu, "$1");
        if(repl === t) continue;
        out.push({ kind: "ejaan-mekanis", pIdx: pIdx, start: tok.start, end: tok.end, original: t, replacement: repl, explanation: "Ada huruf yang terketik tiga kali atau lebih berturut-turut — kemungkinan salah ketik atau penekanan. Usulan merapikannya menjadi satu huruf; abaikan bila memang disengaja.", certainty: "saran", prio: 5 });
      }
    }
    /* ---------- Phase 8.3: Sentence Improvement ----------
       Saran tingkat kalimat yang deterministik berbasis pola. Pemeriksa TIDAK
       memahami makna kalimat: saran penasihat (advisory) tidak pernah mengubah
       teks dan tidak ikut penyaringan tumpang tindih. Penggantian teks hanya
       untuk (a) kata yang terbukti berlebih dan (b) pertukaran frasa
       "melakukan + nomina" menjadi kata kerja satu akar yang maknanya sama. */
    // Kata fungsi untuk menilai gram frasa (gram harus memuat >= 2 kata isi).
    var WI_STOP = { "yang":1, "dan":1, "di":1, "ke":1, "dari":1, "untuk":1, "dengan":1, "pada":1, "adalah":1, "ini":1, "itu":1, "dalam":1, "tidak":1, "akan":1, "juga":1, "telah":1, "atau":1, "sebagai":1, "oleh":1, "karena":1, "sehingga":1, "dapat":1, "lebih":1, "sangat":1, "para":1, "ia":1, "dia":1, "mereka":1, "kita":1, "kami":1, "saya":1, "ada":1, "bukan":1, "sudah":1, "belum":1, "saat":1, "ketika":1, "jika":1, "maka":1, "namun":1, "tetapi":1, "tapi":1, "agar":1, "supaya":1, "bahwa":1, "tersebut":1, "menjadi":1, "antara":1, "atas":1, "bawah":1, "tentang":1, "terhadap":1, "secara":1, "setiap":1, "semua":1, "banyak":1, "beberapa":1, "masih":1, "hanya":1, "pun":1, "saja":1, "yakni":1, "yaitu":1, "setelah":1, "sebelum":1, "selama":1, "sampai":1, "hingga":1, "melalui":1, "tanpa":1, "seperti":1, "merupakan":1, "lain":1, "satu":1 };
    // Penanda klausa bawahan untuk aturan kalimat kompleks.
    var WI_MARKERS = { "yang":1, "karena":1, "sehingga":1, "agar":1, "supaya":1, "ketika":1, "apabila":1, "jika":1, "bahwa":1 };
    // Frasa "melakukan + nomina" -> kata kerja satu akar (makna sama, lebih hemat).
    var WI_NOMINAL = { "penelitian": "meneliti", "pengukuran": "mengukur", "pengamatan": "mengamati", "analisis": "menganalisis", "perhitungan": "menghitung", "pengujian": "menguji", "pengumpulan": "mengumpulkan", "pembahasan": "membahas", "penilaian": "menilai", "pengiriman": "mengirim", "pembayaran": "membayar", "peninjauan": "meninjau", "pemantauan": "memantau", "pendataan": "mendata", "pencatatan": "mencatat", "penghitungan": "menghitung", "kunjungan": "berkunjung", "pengontrolan": "mengontrol", "pengembangan": "mengembangkan", "peningkatan": "meningkatkan", "perbaikan": "memperbaiki", "pemeriksaan": "memeriksa", "pengajuan": "mengajukan" };
    // Pola kata berlebih yang terbukti: urutan token -> bentuk hematnya.
    var WI_MUBAZIR = [
      { seq: ["disebabkan", "karena"], repl: "disebabkan oleh", cert: "pasti", expl: "“Disebabkan” sudah mengandung makna sebab, sehingga “karena” sesudahnya berlebih — bentuk hemat dan bakunya adalah “disebabkan oleh”." },
      { seq: ["agar", "supaya"], repl: "agar", cert: "pasti", expl: "“Agar” dan “supaya” bermakna sama, sehingga tidak perlu dipakai berurutan — cukup salah satu." },
      { seq: ["demi", "untuk"], repl: "untuk", cert: "pasti", expl: "“Demi” dan “untuk” pada posisi ini bermakna sama, sehingga salah satunya berlebih — cukup “untuk”." },
      { seq: ["adalah", "merupakan"], repl: "merupakan", cert: "pasti", expl: "“Adalah” dan “merupakan” sama-sama kata penghubung penjelas; memakai keduanya berurutan adalah pemborosan kata yang lazim dihindari dalam tulisan akademik." },
      { seq: ["yaitu", "adalah"], repl: "yaitu", cert: "pasti", expl: "“Yaitu” dan “adalah” sama-sama memperkenalkan penjelasan, sehingga salah satunya berlebih — cukup “yaitu”." },
      { seq: ["naik", "ke", "atas"], repl: "naik", cert: "gaya", expl: "“Naik” sudah berarti bergerak ke atas, sehingga “ke atas” dapat dihilangkan agar lebih hemat. Abaikan bila arah memang perlu ditekankan (misalnya “naik ke atas panggung”)." },
      { seq: ["turun", "ke", "bawah"], repl: "turun", cert: "gaya", expl: "“Turun” sudah berarti bergerak ke bawah, sehingga “ke bawah” dapat dihilangkan agar lebih hemat. Abaikan bila arah memang perlu ditekankan." },
      { seq: ["masuk", "ke", "dalam"], repl: "masuk", cert: "gaya", expl: "“Masuk” sudah berarti bergerak ke dalam, sehingga “ke dalam” dapat dihilangkan agar lebih hemat. Abaikan bila penekanan arah memang diperlukan (misalnya “masuk ke dalam ruangan”)." }
    ];
    // Rentang teks di dalam tanda kurung — titik di dalamnya tidak pernah memisah kalimat.
    function wiParenSpans(p){
      var spans = [], depth = 0, open = -1;
      for(var i=0;i<p.length;i++){
        var c = p.charAt(i);
        if(c === "("){ if(depth === 0) open = i; depth++; }
        else if(c === ")"){ if(depth > 0){ depth--; if(depth === 0 && open >= 0){ spans.push([open, i]); open = -1; } } }
      }
      if(open >= 0) spans.push([open, p.length - 1]);
      return spans;
    }
    // Segmentasi kalimat konservatif: memisah pada [.!?…] yang diikuti spasi +
    // huruf kapital/angka atau akhir paragraf. Menghormati singkatan (WI_ABBR,
    // termasuk gelar), desimal, URL/domain, elipsis, dan sitasi bertanda kurung.
    // Titik akhir kalimat di dalam tanda kutip menutup kalimat sesudah tanda
    // kutipnya. Bila ragu, TIDAK memisah.
    function wiSentences(p, quotes){
      var spans = [], n = p.length;
      var qs = quotes || wiQuoteSpans(p);
      function firstNonSpace(from){ var j = from; while(j < n && /\s/.test(p.charAt(j))) j++; return j; }
      var cur = firstNonSpace(0), i = 0, depth = 0;
      while(i < n){
        var c = p.charAt(i);
        if(c === "("){ depth++; i++; continue; }
        if(c === ")"){ if(depth > 0) depth--; i++; continue; }
        if(depth === 0 && (c === "." || c === "!" || c === "?" || c === "…")){
          var j = i;
          while(j < n && /[.!?…]/.test(p.charAt(j))) j++;
          var cluster = p.slice(i, j);
          var wb = (p.slice(0, i).match(/[\p{L}]+$/u) || [""])[0];
          var skip = false;
          if(cluster === "." && wb && (wb.length <= 1 || WI_ABBR[wb.toLowerCase()])) skip = true;
          if(cluster === "." && /\d/.test(p.charAt(i - 1))) skip = true;
          if(!skip && wiBadCtx(p, i, j)) skip = true;
          if(!skip && wiInSpans(qs, i)){
            var qEnd = -1;
            for(var q=0;q<qs.length;q++){ if(i >= qs[q][0] && i <= qs[q][1]) qEnd = qs[q][1]; }
            if(j !== qEnd) skip = true;
          }
          if(!skip){
            var k = j;
            while(k < n && /["”’»]/.test(p.charAt(k))) k++;
            if(k >= n){ spans.push({ start: cur, end: k }); cur = n; i = n; break; }
            if(/\s/.test(p.charAt(k))){
              var m = firstNonSpace(k);
              if(m >= n){ spans.push({ start: cur, end: k }); cur = n; i = n; break; }
              var nc = p.charAt(m), split = false;
              if(/[\p{Lu}]/u.test(nc) || /\d/.test(nc)) split = true;
              else if(/["'“‘«]/.test(nc) && m + 1 < n && /[\p{Lu}]/u.test(p.charAt(m + 1))) split = true;
              if(split){ spans.push({ start: cur, end: k }); cur = m; i = m; continue; }
            }
          }
          i = j; continue;
        }
        i++;
      }
      if(cur < n){
        var e = n; while(e > cur && /\s/.test(p.charAt(e - 1))) e--;
        if(e > cur) spans.push({ start: cur, end: e });
      }
      return spans;
    }
    // Gram kata isi: gram `size` token berurutan yang memuat >= 2 kata bukan kata
    // fungsi. Gram yang memuat dua token sama menempel (kata ulang / ketik ganda)
    // atau token di dalam kutip dilewati.
    function wiGramCounts(sentText, size, sentStart, quotes){
      var toks = wiTokens(sentText), counts = {}, order = [];
      for(var i=0;i + size <= toks.length;i++){
        var parts = [], content = 0, bad = false;
        for(var t=0;t<size;t++){
          var tk = toks[i+t], low = tk.t.toLowerCase();
          parts.push(low);
          if(!WI_STOP[low]) content++;
          if(t > 0 && toks[i+t-1].t.toLowerCase() === low) bad = true;
          if(quotes && wiInSpans(quotes, sentStart + tk.start)) bad = true;
        }
        if(bad || content < 2) continue;
        var key = parts.join(" ");
        if(!counts[key]){ counts[key] = 0; order.push(key); }
        counts[key]++;
      }
      return { counts: counts, order: order };
    }
    function wiRuleMubazir(p, pIdx, out, ctx){
      var toks = wiTokens(p);
      function blocked(tok){
        if(ctx && wiInSpans(ctx.quotes, tok.start)) return true;
        if(ctx && wiInSpans(ctx.parens, tok.start)) return true;
        return false;
      }
      function gapOk(a, b){ return /^[ \t]+$/.test(p.slice(a.end, b.start)); }
      for(var e=0;e<WI_MUBAZIR.length;e++){
        var pat = WI_MUBAZIR[e];
        for(var i=0;i + pat.seq.length <= toks.length;i++){
          var okm = true;
          for(var t=0;t<pat.seq.length;t++){
            if(toks[i+t].t.toLowerCase() !== pat.seq[t]){ okm = false; break; }
            if(t > 0 && !gapOk(toks[i+t-1], toks[i+t])){ okm = false; break; }
            if(blocked(toks[i+t])){ okm = false; break; }
          }
          if(!okm) continue;
          var first = toks[i], last = toks[i + pat.seq.length - 1];
          if(wiBadCtx(p, first.start, last.end)) continue;
          out.push({ kind: "kalimat-mubazir", pIdx: pIdx, start: first.start, end: last.end, original: p.slice(first.start, last.end), replacement: wiMatchCase(pat.repl, /[\p{Lu}]/u.test(first.t.charAt(0))), explanation: pat.expl, certainty: pat.cert, prio: 4 });
        }
      }
      for(var j2=0;j2 + 1 < toks.length;j2++){
        if(toks[j2].t.toLowerCase() !== "melakukan") continue;
        var nx = toks[j2+1], verb = WI_NOMINAL[nx.t.toLowerCase()];
        if(!verb) continue;
        if(!gapOk(toks[j2], nx)) continue;
        if(blocked(toks[j2]) || blocked(nx)) continue;
        if(wiBadCtx(p, toks[j2].start, nx.end)) continue;
        out.push({ kind: "kalimat-mubazir", pIdx: pIdx, start: toks[j2].start, end: nx.end, original: p.slice(toks[j2].start, nx.end), replacement: wiMatchCase(verb, /[\p{Lu}]/u.test(toks[j2].t.charAt(0))), explanation: "Frasa “melakukan " + nx.t.toLowerCase() + "” dapat diringkas menjadi kata kerja satu akarnya, “" + verb + "” — maknanya sama dan lebih hemat kata. Kata sesudah nomina tersebut tidak berubah.", certainty: "gaya", prio: 5 });
      }
    }
    function wiRuleFrasa(p, pIdx, out, ctx){
      var quotes = ctx ? ctx.quotes : null;
      var sents = wiSentences(p, quotes);
      var gram4 = sents.map(function(s){ return wiGramCounts(p.slice(s.start, s.end), 4, s.start, quotes); });
      sents.forEach(function(s, si){
        var sentText = p.slice(s.start, s.end);
        var g3 = wiGramCounts(sentText, 3, s.start, quotes);
        var phrase = null, cross = false;
        for(var i=0;i<g3.order.length;i++){ if(g3.counts[g3.order[i]] >= 2){ phrase = g3.order[i]; break; } }
        if(!phrase && si > 0){
          var prev = gram4[si-1].counts, cur4 = gram4[si];
          for(var j=0;j<cur4.order.length;j++){ if(prev[cur4.order[j]]){ phrase = cur4.order[j]; cross = true; break; } }
        }
        if(!phrase) return;
        out.push({ kind: "kalimat-pengulangan-frasa", pIdx: pIdx, start: s.start, end: s.end, original: sentText, replacement: null, advisory: true, advPrio: 0, sentKey: pIdx + ":" + s.start, certainty: "potensial", prio: 9, explanation: cross
          ? "Frasa “" + phrase + "” juga muncul pada kalimat sebelumnya. Pengulangan frasa yang sama pada dua kalimat berurutan dapat terasa monoton dan kadang menandakan informasi yang tertulis dua kali. Periksa apakah pengulangan ini disengaja — pemeriksa tidak menilai makna."
          : "Frasa “" + phrase + "” muncul lebih dari sekali dalam kalimat ini. Bila tidak disengaja, pertimbangkan menghapus salah satunya atau menggantinya dengan kata lain — pemeriksa tidak menilai makna." });
      });
    }
    function wiRuleKompleks(p, pIdx, out, ctx){
      var sents = wiSentences(p, ctx ? ctx.quotes : null);
      sents.forEach(function(s){
        var sentText = p.slice(s.start, s.end);
        var toks = wiTokens(sentText), markers = 0;
        toks.forEach(function(tk){ if(WI_MARKERS[tk.t.toLowerCase()]) markers++; });
        var commas = (sentText.match(/,/g) || []).length;
        var isEnum = false;
        if(commas >= 3){
          var segs = sentText.split(",");
          isEnum = segs.slice(0, segs.length - 1).every(function(sg){ return sg.trim().split(/\s+/).filter(Boolean).length <= 4; });
        }
        if(!(markers >= 3 || (commas >= 4 && !isEnum))) return;
        out.push({ kind: "kalimat-kompleks", pIdx: pIdx, start: s.start, end: s.end, original: sentText, replacement: null, advisory: true, advPrio: 1, sentKey: pIdx + ":" + s.start, certainty: "potensial", prio: 9, explanation: "Kalimat ini memuat " + markers + " penanda klausa bawahan dan " + commas + " koma — pola seperti ini berpotensi sulit diikuti pembaca dalam sekali baca. Pemeriksa tidak menilai makna: bila kerumitan ini memang diperlukan, abaikan saran ini; bila tidak, pertimbangkan memecahnya menjadi dua kalimat." });
      });
    }
    function wiRulePanjang(p, pIdx, out, ctx){
      var sents = wiSentences(p, ctx ? ctx.quotes : null);
      sents.forEach(function(s){
        var sentText = p.slice(s.start, s.end);
        var wc = wiTokens(sentText).length, expl = null;
        if(wc > 40){
          expl = "Kalimat ini panjang (" + wc + " kata). Kalimat panjang tidak otomatis salah — dalam tulisan akademik ia sering sah dan perlu — tetapi berisiko sulit diikuti pembaca. Periksa kembali apakah kalimat ini masih nyaman dibaca sekali jalan; bila tidak, pertimbangkan memecahnya di batas klausa. Saran ini tidak mengubah teks.";
        } else if(wc > 30 && !/[,;]/.test(sentText)){
          expl = "Kalimat ini cukup panjang (" + wc + " kata) dan tidak memiliki koma atau titik koma sama sekali, sehingga pembaca tidak mendapat jeda. Kalimat panjang tidak otomatis salah, tetapi periksa kembali keterbacaannya; bila perlu, tambahkan jeda atau pecah kalimat di batas klausa. Saran ini tidak mengubah teks.";
        }
        if(!expl) return;
        out.push({ kind: "kalimat-panjang", pIdx: pIdx, start: s.start, end: s.end, original: sentText, replacement: null, advisory: true, advPrio: 2, sentKey: pIdx + ":" + s.start, certainty: "potensial", prio: 9, explanation: expl });
      });
    }
    function wiRuleTransisi(p, pIdx, out, ctx){
      var sents = wiSentences(p, ctx ? ctx.quotes : null);
      if(sents.length < 3) return;
      var openings = sents.map(function(s){
        var txt = p.slice(s.start, s.end).replace(/^[\s"'“”‘’«»]+/, "");
        return wiTokens(txt).map(function(t){ return t.t.toLowerCase(); });
      });
      function findOpen(size){
        var counts = {}, order = [];
        openings.forEach(function(words, idx){
          if(words.length < size) return;
          var first = words[0];
          if(/^\d+$/.test(first) || first.length === 1) return;
          var key = words.slice(0, size).join(" ");
          if(!counts[key]){ counts[key] = []; order.push(key); }
          counts[key].push(idx);
        });
        for(var i=0;i<order.length;i++){ if(counts[order[i]].length >= 3) return { key: order[i], third: counts[order[i]][2] }; }
        return null;
      }
      var hit = findOpen(2) || findOpen(1);
      if(!hit) return;
      var s = sents[hit.third];
      out.push({ kind: "transisi-awalan", pIdx: pIdx, start: s.start, end: s.end, original: p.slice(s.start, s.end), replacement: null, advisory: true, advPrio: 3, sentKey: pIdx + ":" + s.start, certainty: "gaya", prio: 9, explanation: "Sedikitnya tiga kalimat dalam paragraf ini diawali pola yang sama (“" + hit.key + " …”), sehingga alurnya dapat terasa monoton. Bila tidak disengaja, variasikan awalan kalimat — misalnya dengan kata transisi lain atau dengan mendahulukan unsur lain kalimat. Saran ini tidak mengubah teks." });
    }
    var WI_RULES = [wiRuleUlang, wiRuleRepeated, wiRuleSpaces, wiRuleMissingSpace, wiRuleCapital, wiRuleBaku, wiRuleDepan, wiRuleImbuhan, wiRulePemisahan, wiRulePunct2, wiRuleCapitalSaya, wiRuleEjaan, wiRuleMubazir, wiRuleFrasa, wiRuleKompleks, wiRulePanjang, wiRuleTransisi];
    function wiAnalyze(text, opts){
      var norm = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
      var truncated = false;
      if(norm.length > WI_MAX_CHARS){ norm = norm.slice(0, WI_MAX_CHARS); truncated = true; }
      var ignore = null;
      if(opts && opts.ignoreWords && typeof opts.ignoreWords.forEach === "function"){
        ignore = {};
        opts.ignoreWords.forEach(function(w){ if(w != null) ignore[String(w).toLowerCase()] = 1; });
      }
      var sp = wiSplitParas(norm);
      var cand = [];
      sp.paras.forEach(function(p, idx){
        if(!p || !/\S/.test(p)) return;
        var ctx = { ignore: ignore, quotes: wiQuoteSpans(p), parens: wiParenSpans(p) };
        for(var r=0;r<WI_RULES.length;r++) WI_RULES[r](p, idx, cand, ctx);
      });
      // Saran penasihat (Phase 8.3) dipisah: tidak ikut penyaringan tumpang
      // tindih dan maksimal satu per kalimat (prioritas advPrio terkecil).
      var adv = cand.filter(function(c){ return c.advisory; });
      cand = cand.filter(function(c){ return !c.advisory; });
      cand.sort(function(a, b){ return a.pIdx - b.pIdx || a.start - b.start || a.prio - b.prio || (b.end - b.start) - (a.end - a.start); });
      var kept = [], lastEnd = {};
      cand.forEach(function(c){
        var le = lastEnd[c.pIdx] === undefined ? -1 : lastEnd[c.pIdx];
        if(c.start >= le){ kept.push(c); lastEnd[c.pIdx] = c.end; }
      });
      var advBySent = {};
      adv.forEach(function(a){
        var k = a.sentKey || (a.pIdx + ":" + a.start);
        if(!advBySent[k] || a.advPrio < advBySent[k].advPrio) advBySent[k] = a;
      });
      var all = kept.concat(Object.keys(advBySent).map(function(k){ return advBySent[k]; }));
      all.sort(function(a, b){ return a.pIdx - b.pIdx || a.start - b.start || (a.advisory ? 1 : 0) - (b.advisory ? 1 : 0) || (b.end - b.start) - (a.end - a.start); });
      var suggestions = all.map(function(c, i){
        var s = { id: "wi-" + (i+1), kind: c.kind, pIdx: c.pIdx, start: c.start, end: c.end, original: c.original, replacement: c.replacement, explanation: c.explanation, certainty: c.certainty };
        if(c.word) s.word = c.word;
        if(c.advisory) s.advisory = true;
        return s;
      });
      return { paragraphs: sp.paras, separators: sp.seps, suggestions: suggestions, truncated: truncated };
    }
    function wiApply(paragraphs, suggestions, acceptedIds){
      var acc = {};
      (acceptedIds || []).forEach(function(id){ acc[id] = 1; });
      var byPara = {};
      (suggestions || []).forEach(function(s){
        if(acc[s.id] && !s.advisory && typeof s.replacement === "string"){ (byPara[s.pIdx] = byPara[s.pIdx] || []).push(s); }
      });
      return paragraphs.map(function(p, idx){
        var list = byPara[idx];
        if(!list || !list.length) return p;
        list = list.slice().sort(function(a, b){ return b.start - a.start; });
        var out = p;
        for(var i=0;i<list.length;i++){ out = out.slice(0, list[i].start) + list[i].replacement + out.slice(list[i].end); }
        return out;
      });
    }
    /* ---------- Phase 8.4: Readability Analyzer ----------
       wiReadability(text) murni dan deterministik: statistik kalimat dan
       paragraf plus satu skor gabungan. Skor itu ESTIMASI dari lima
       komponen statistik di bawah — bukan standar ilmiah, bukan formula
       keterbacaan internasional, bukan penilaian kualitas tulisan, dan
       tanpa label tingkat pendidikan pembaca. Kalimat atau paragraf yang
       panjang adalah indikator untuk ditinjau, bukan kesalahan. Komponen
       dihitung dari angka yang sama persis dengan yang ditampilkan
       (rata-rata terbulatkan), agar pengguna dapat memeriksa ulang
       hitungannya sendiri. */
    // Perkiraan suku kata Bahasa Indonesia: jumlah gugus vokal — huruf
    // vokal (a/i/u/e/o) yang berurutan dihitung sebagai satu gugus,
    // sehingga diftong seperti "ai"/"au" terhitung satu suku kata.
    // Ini pendekatan kasar: kata serapan, nama diri, dan kata dengan
    // vokal berurutan lintas suku kata (mis. "saat") dapat meleset.
    function wiSyllables(word){
      var w = String(word == null ? "" : word).toLowerCase();
      if(!/\p{L}/u.test(w)) return 0;
      var m = w.match(/[aiueo]+/g);
      return m ? m.length : 1;
    }
    function wiRound(x, d){
      var f = Math.pow(10, d || 1);
      return Math.round(x * f) / f;
    }
    function wiBandLabel(score){
      if(score >= 80) return "Sangat mudah diikuti";
      if(score >= 60) return "Mudah diikuti";
      if(score >= 40) return "Cukup menuntut";
      if(score >= 20) return "Menuntut";
      return "Sangat menuntut";
    }
    function wiReadability(text){
      var norm = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
      if(norm.length > WI_MAX_CHARS) norm = norm.slice(0, WI_MAX_CHARS);
      var R = { empty: true, chars: norm.length, words: 0, sentences: 0, paragraphs: 0,
        sentenceLengths: [], avgWordsPerSentence: 0, minSentence: 0, maxSentence: 0,
        buckets: { pendek: 0, sedang: 0, panjang: 0 }, longShare: 0,
        paraWords: [], paraSentences: [], avgSentencesPerParagraph: 0, avgWordsPerParagraph: 0,
        denseParas: [], shortParas: [], paraBuckets: { le25: 0, le75: 0, le150: 0, gt150: 0 },
        avgWordChars: 0, avgSyllables: 0, longWordShare: 0,
        sdSentence: 0, cvSentence: 0,
        components: { sentence: 0, variation: 0, longWords: 0, longSentences: 0, paragraph: 0 },
        score: 0, band: wiBandLabel(0), longestSentenceText: "", longestSentenceWords: 0 };
      var totalChars = 0, letterWords = 0, totalSyl = 0, longWords = 0;
      wiSplitParas(norm).paras.forEach(function(p){
        if(!wiTokens(p).length) return;
        var sents = wiSentences(p).map(function(s){
          var txt = p.slice(s.start, s.end);
          return { text: txt, words: wiTokens(txt) };
        }).filter(function(s){ return s.words.length > 0; });
        if(!sents.length) return;
        var pw = 0;
        sents.forEach(function(s){
          pw += s.words.length;
          R.sentenceLengths.push(s.words.length);
          if(s.words.length > R.longestSentenceWords){ R.longestSentenceWords = s.words.length; R.longestSentenceText = s.text; }
          s.words.forEach(function(tok){
            totalChars += tok.t.length;
            if(/\p{L}/u.test(tok.t)){
              letterWords++;
              var syl = wiSyllables(tok.t);
              totalSyl += syl;
              if(syl >= 4) longWords++;
            }
          });
        });
        R.paraWords.push(pw);
        R.paraSentences.push(sents.length);
      });
      R.paragraphs = R.paraWords.length;
      R.sentences = R.sentenceLengths.length;
      R.words = R.sentenceLengths.reduce(function(a, b){ return a + b; }, 0);
      if(!R.sentences) return R;
      R.empty = false;
      var mean = R.words / R.sentences;
      R.avgWordsPerSentence = wiRound(mean, 1);
      R.minSentence = Math.min.apply(null, R.sentenceLengths);
      R.maxSentence = Math.max.apply(null, R.sentenceLengths);
      var longCount = 0;
      R.sentenceLengths.forEach(function(L){
        if(L <= 12) R.buckets.pendek++;
        else if(L <= 25) R.buckets.sedang++;
        else R.buckets.panjang++;
        if(L > 40) longCount++;
      });
      R.longShare = wiRound(100 * longCount / R.sentences, 1);
      var varSum = 0;
      R.sentenceLengths.forEach(function(L){ varSum += (L - mean) * (L - mean); });
      var sd = Math.sqrt(varSum / R.sentences);
      R.sdSentence = wiRound(sd, 2);
      R.cvSentence = wiRound(mean > 0 ? sd / mean : 0, 2);
      R.avgSentencesPerParagraph = wiRound(R.sentences / R.paragraphs, 1);
      R.avgWordsPerParagraph = wiRound(R.words / R.paragraphs, 1);
      R.paraWords.forEach(function(pw, i){
        if(pw <= 25) R.paraBuckets.le25++;
        else if(pw <= 75) R.paraBuckets.le75++;
        else if(pw <= 150) R.paraBuckets.le150++;
        else R.paraBuckets.gt150++;
        if(pw > 150 || R.paraSentences[i] > 8) R.denseParas.push(i);
        if(R.paraSentences[i] === 1 && pw < 15) R.shortParas.push(i);
      });
      R.avgWordChars = wiRound(totalChars / R.words, 1);
      R.avgSyllables = letterWords ? wiRound(totalSyl / letterWords, 2) : 0;
      R.longWordShare = letterWords ? wiRound(100 * longWords / letterWords, 1) : 0;
      function clamp100(x){ return x < 0 ? 0 : (x > 100 ? 100 : x); }
      var avg = R.avgWordsPerSentence, cv = R.cvSentence, awp = R.avgWordsPerParagraph;
      var cSentence = avg < 12 ? Math.max(0, (avg - 4) / 8 * 100) : (avg <= 22 ? 100 : Math.max(0, 100 - (avg - 22) / 18 * 100));
      var cVariation = cv < 0.35 ? Math.max(0, (cv - 0.1) / 0.25 * 100) : (cv <= 0.75 ? 100 : Math.max(0, 100 - (cv - 0.75) / 0.45 * 100));
      var cLongWords = 100 - clamp100(R.longWordShare * 2.5);
      var cLongSentences = 100 - clamp100(R.longShare * 2);
      var cParagraph = awp < 40 ? Math.max(0, (awp - 10) / 30 * 100) : (awp <= 120 ? 100 : Math.max(0, 100 - (awp - 120) / 130 * 100));
      R.components = { sentence: Math.round(cSentence), variation: Math.round(cVariation), longWords: Math.round(cLongWords), longSentences: Math.round(cLongSentences), paragraph: Math.round(cParagraph) };
      R.score = Math.round(0.30 * R.components.sentence + 0.15 * R.components.variation + 0.20 * R.components.longWords + 0.20 * R.components.longSentences + 0.15 * R.components.paragraph);
      R.band = wiBandLabel(R.score);
      return R;
    }
    /* ---------- Phase 8.5: Writing Style Control ----------
       wiStyle(text, profile) murni dan deterministik: analisis konsistensi
       gaya berbasis PENCocokan POLA terhadap daftar kurasi tertutup di
       bawah — BUKAN analisis semantik: pemeriksa tidak memahami makna,
       maksud, niat, atau kepribadian penulis. Profil adalah konteks
       pemeriksaan, bukan klasifikasi mutlak: satu tulisan dapat
       menunjukkan beberapa gaya sekaligus dan tidak ada gaya yang lebih
       baik dari gaya lainnya. Kata informal BUKAN kesalahan; semua
       temuan bersifat saran yang disebutkan, tidak pernah mengganti teks. */
    // Penanda ragam informal/cakapan yang kuat (daftar kurasi tertutup).
    var WI_INFORMAL = { "nggak":1, "gak":1, "ngga":1, "banget":1, "kok":1, "sih":1, "dong":1, "deh":1, "lho":1, "nih":1, "tuh":1, "kayak":1, "bikin":1, "ngomong":1, "udah":1, "aja":1, "gimana":1, "emang":1, "pengen":1, "soalnya":1, "pokoknya":1, "beneran":1, "gue":1, "gua":1, "lo":1, "lu":1 };
    // Kelompok kata ganti (sapaan): [kunci kelompok, daftar katanya].
    var WI_PRON_SETS_1 = [ ["saya", ["saya"]], ["aku", ["aku"]], ["gue/gua", ["gue", "gua"]] ];
    var WI_PRON_SETS_2 = [ ["anda", ["anda"]], ["kamu", ["kamu"]], ["lo/lu", ["lo", "lu"]] ];
    // Kelompok istilah setara: variasi dalam satu kelompok sebaiknya tidak
    // dicampur dalam satu dokumen. Frasa multi-kata dicocokkan sebagai
    // urutan token; variasi terpanjang dicocokkan lebih dulu agar
    // "situs web" tidak ikut terhitung sebagai "web".
    var WI_TERM_VARIANTS = [
      ["email", "e-mail", "surel"],
      ["ponsel", "handphone", "hp", "telepon pintar", "smartphone"],
      ["situs web", "website", "web"],
      ["unduh", "download"],
      ["daring", "online"],
      ["rapat", "meeting"],
      ["tenggat waktu", "deadline"],
      ["umpan balik", "feedback"],
      ["fotokopi", "foto copy", "photocopy"],
      ["pembaruan", "update"],
      ["kata sandi", "password"],
      ["layar", "screen"]
    ];
    // Satuan dan dua bentuk penulisannya. kind: "token" = token biasa;
    // "afterNumber" = token tepat sesudah angka ("5 l"); "beforeNumber" =
    // token tepat sebelum angka ("Rp 5.000"); "symbol" = simbol tepat
    // sesudah angka ("10%").
    var WI_UNIT_VARIANTS = [
      { short: "km", long: "kilometer", kind: "token" },
      { short: "kg", long: "kilogram", kind: "token" },
      { short: "cm", long: "sentimeter", kind: "token" },
      { short: "mm", long: "milimeter", kind: "token" },
      { short: "l", long: "liter", kind: "afterNumber" },
      { short: "%", long: "persen", kind: "symbol" },
      { short: "rp", long: "rupiah", kind: "beforeNumber" }
    ];
    // Frasa birokratis yang kerap terasa berbelit bagi pembaca umum.
    var WI_BIROKRASI = ["dalam rangka", "sehubungan dengan", "berkenaan dengan", "pada hakikatnya", "dimaksudkan untuk", "dalam hal ini"];
    // Kata fungsi untuk statistik kosakata: WI_STOP ditambah kata hubung
    // dan penanda wacana yang belum ada di dalamnya.
    var WI_STYLE_STOP = {};
    Object.keys(WI_STOP).forEach(function(k){ WI_STYLE_STOP[k] = 1; });
    ["serta", "maupun", "ataupun", "yakni", "dll", "dsb", "dst"].forEach(function(k){ WI_STYLE_STOP[k] = 1; });
    var WI_STYLE_PROFILES = { "formal":1, "akademik":1, "profesional":1, "populer":1, "ringkas":1, "naratif":1 };
    var WI_STYLE_PROFILE_LABEL = { "formal": "Formal", "akademik": "Akademik", "profesional": "Profesional", "populer": "Populer", "ringkas": "Ringkas", "naratif": "Naratif" };
    // Konteks tampil: beberapa token di sekitar rentang token [a..b] pada
    // paragraf P, dipotong dari teks mentah agar tanda baca ikut terbaca.
    function wiStyleExcerpt(P, a, b){
      var s = Math.max(0, a - 4), e = Math.min(P.toks.length - 1, b + 4);
      if(s > e || !P.toks.length) return "";
      return (s > 0 ? "… " : "") + P.text.slice(P.toks[s].start, P.toks[e].end) + (e < P.toks.length - 1 ? " …" : "");
    }
    // Mencocokkan urutan token `words` pada paragraf P, di luar kutip.
    // `consumed` (opsional) menandai indeks token yang sudah dipakai oleh
    // variasi yang lebih panjang agar tidak dihitung dua kali. Jeda antar
    // token hanya boleh spasi/baris baru atau satu tanda hubung (e-mail).
    function wiStylePhraseHits(P, words, consumed){
      var hits = [];
      for(var i=0;i + words.length <= P.toks.length;i++){
        var okm = true;
        for(var t=0;t<words.length;t++){
          if(consumed && consumed[i+t]){ okm = false; break; }
          if(P.toks[i+t].t.toLowerCase() !== words[t]){ okm = false; break; }
          if(wiInSpans(P.quotes, P.toks[i+t].start)){ okm = false; break; }
          if(t > 0 && !/^[\s-]+$/.test(P.text.slice(P.toks[i+t-1].end, P.toks[i+t].start))){ okm = false; break; }
        }
        if(!okm) continue;
        if(consumed) for(var t2=0;t2<words.length;t2++) consumed[i+t2] = 1;
        hits.push({ i: i, j: i + words.length - 1 });
      }
      return hits;
    }
    function wiStyle(text, profile){
      var prof = WI_STYLE_PROFILES[profile] ? profile : "formal";
      var norm = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
      var truncated = false;
      if(norm.length > WI_MAX_CHARS){ norm = norm.slice(0, WI_MAX_CHARS); truncated = true; }
      var S = { empty: true, profile: prof, truncated: truncated, chars: norm.length, words: 0,
        indicators: {
          formality: { informalCount: 0, formalPronouns: 0, density: 0, informalWords: [], label: "Cenderung formal" },
          conciseness: { avgWordsPerSentence: 0, label: "Kalimat berukuran sedang" },
          vocabRepeat: { ttr: 0, unique: 0, total: 0, topRepeated: [] },
          termConsistency: { variantGroups: 0, label: "Istilah konsisten" },
          sentenceVariation: { cv: 0, label: "Panjang kalimat cukup bervariasi" },
          density: { avgSyllables: 0, longWordShare: 0, label: "Bahasa sedang" }
        },
        findings: [] };
      var sp = wiSplitParas(norm);
      var paras = [], off = 0;
      sp.paras.forEach(function(p, i){
        paras.push({ text: p, offset: off, toks: wiTokens(p), quotes: wiQuoteSpans(p), parens: wiParenSpans(p) });
        off += p.length + (i < sp.seps.length ? sp.seps[i].length : 0);
      });
      var allToks = [];
      paras.forEach(function(P){ P.toks.forEach(function(t){ allToks.push(t); }); });
      var letterToks = allToks.filter(function(t){ return /\p{L}/u.test(t.t); });
      if(!letterToks.length) return S;
      S.empty = false;
      S.words = allToks.length;
      var R = wiReadability(norm);
      /* ----- sapaan (kata ganti), di luar kutip ----- */
      function pronScan(sets){
        var counts = {}, first = {};
        sets.forEach(function(s){ counts[s[0]] = 0; });
        paras.forEach(function(P){
          P.toks.forEach(function(tok, ti){
            var low = tok.t.toLowerCase();
            for(var si=0;si<sets.length;si++){
              if(sets[si][1].indexOf(low) < 0) continue;
              if(wiInSpans(P.quotes, tok.start)) return;
              counts[sets[si][0]]++;
              if(!first[sets[si][0]]) first[sets[si][0]] = { idx: P.offset + tok.start, excerpt: wiStyleExcerpt(P, ti, ti) };
              break;
            }
          });
        });
        return { counts: counts, first: first };
      }
      var pron1 = pronScan(WI_PRON_SETS_1), pron2 = pronScan(WI_PRON_SETS_2);
      /* ----- penanda informal, di luar kutip, dengan penjaga nama ----- */
      var informal = {}, informalOrder = [];
      paras.forEach(function(P){
        P.toks.forEach(function(tok, ti){
          var low = tok.t.toLowerCase();
          if(!WI_INFORMAL[low]) return;
          if(wiInSpans(P.quotes, tok.start)) return;
          if(wiBadCtx(P.text, tok.start, tok.end)) return;
          if(/\d/.test(tok.t)) return;
          if(tok.t.length > 1 && tok.t === tok.t.toUpperCase() && tok.t !== tok.t.toLowerCase()) return;
          if(/[\p{Lu}]/u.test(tok.t.slice(1))) return;
          if(/[\p{Lu}]/u.test(tok.t.charAt(0))){
            // Kapital di tengah kalimat kemungkinan nama diri — lewati,
            // meniru penjaga wiDictFire. Kapital di awal kalimat dihitung.
            if(!wiSentenceStart(P.text, tok.start)) return;
            var nx = P.toks[ti+1];
            if(nx && /[\p{Lu}]/u.test(nx.t.charAt(0)) && !/[.!?…]/.test(P.text.slice(tok.end, nx.start))) return;
          }
          if(!informal[low]){ informal[low] = { word: low, count: 0, idx: P.offset + tok.start, excerpt: wiStyleExcerpt(P, ti, ti) }; informalOrder.push(low); }
          informal[low].count++;
        });
      });
      var informalCount = 0;
      informalOrder.forEach(function(w){ informalCount += informal[w].count; });
      /* ----- indikator ----- */
      // Ambang formalitas (kepadatan kata informal per 100 kata):
      // 0 = cenderung formal; <= 1,5 = sebagian besar formal;
      // <= 4 = campuran; di atasnya = cenderung informal.
      var formalPron = pron1.counts["saya"] + pron2.counts["anda"];
      var density100 = S.words ? wiRound(100 * informalCount / S.words, 1) : 0;
      S.indicators.formality = { informalCount: informalCount, formalPronouns: formalPron, density: density100,
        informalWords: informalOrder.map(function(w){ return { word: w, count: informal[w].count }; }),
        label: density100 === 0 ? "Cenderung formal" : density100 <= 1.5 ? "Sebagian besar formal" : density100 <= 4 ? "Campuran formal dan informal" : "Cenderung informal" };
      // Ambang keringkasan (rata-rata kata per kalimat): < 14 ringkas;
      // 14–24 sedang; > 24 panjang.
      var avgW = R.avgWordsPerSentence;
      S.indicators.conciseness = { avgWordsPerSentence: avgW, label: avgW < 14 ? "Kalimat cenderung ringkas" : avgW <= 24 ? "Kalimat berukuran sedang" : "Kalimat cenderung panjang" };
      // Ambang variasi kalimat (koefisien variasi panjang kalimat):
      // < 0,25 seragam; 0,25–0,6 cukup bervariasi; > 0,6 sangat bervariasi.
      var cv = R.cvSentence;
      S.indicators.sentenceVariation = { cv: cv, label: cv < 0.25 ? "Panjang kalimat seragam" : cv <= 0.6 ? "Panjang kalimat cukup bervariasi" : "Panjang kalimat sangat bervariasi" };
      // Ambang kepadatan bahasa (proporsi kata panjang >= 4 suku kata):
      // < 10% ringan; 10–25% sedang; > 25% padat.
      var lws = R.longWordShare;
      S.indicators.density = { avgSyllables: R.avgSyllables, longWordShare: lws, label: lws < 10 ? "Bahasa ringan" : lws <= 25 ? "Bahasa sedang" : "Bahasa padat" };
      /* ----- kosakata: rasio type-token & kata isi paling sering ----- */
      var vCounts = {}, vTotal = 0;
      paras.forEach(function(P){
        P.toks.forEach(function(tok){
          if(!/\p{L}/u.test(tok.t)) return;
          var low = tok.t.toLowerCase();
          vCounts[low] = (vCounts[low] || 0) + 1;
          vTotal++;
        });
      });
      var vUnique = Object.keys(vCounts).length;
      var topRepeated = Object.keys(vCounts)
        .filter(function(w){ return vCounts[w] >= 3 && w.length >= 2 && !WI_STYLE_STOP[w]; })
        .map(function(w){ return { word: w, count: vCounts[w] }; })
        .sort(function(a, b){ return b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0); })
        .slice(0, 5);
      S.indicators.vocabRepeat = { ttr: vTotal ? wiRound(vUnique / vTotal, 3) : 0, unique: vUnique, total: vTotal, topRepeated: topRepeated };
      /* ----- variasi istilah setara ----- */
      var termFound = [];
      WI_TERM_VARIANTS.forEach(function(group){
        var counts = {}, firstIdx = Infinity, firstExcerpt = "";
        group.forEach(function(v){ counts[v] = 0; });
        var variants = group.map(function(v){ return { v: v, words: v.split(" ") }; })
          .sort(function(a, b){ return b.words.length - a.words.length; });
        paras.forEach(function(P){
          var consumed = {};
          variants.forEach(function(vr){
            wiStylePhraseHits(P, vr.words, consumed).forEach(function(h){
              counts[vr.v]++;
              var gi = P.offset + P.toks[h.i].start;
              if(gi < firstIdx){ firstIdx = gi; firstExcerpt = wiStyleExcerpt(P, h.i, h.j); }
            });
          });
        });
        var used = group.filter(function(v){ return counts[v] > 0; });
        if(used.length >= 2) termFound.push({ counts: counts, used: used, idx: firstIdx, excerpt: firstExcerpt });
      });
      S.indicators.termConsistency = { variantGroups: termFound.length, label: termFound.length === 0 ? "Istilah konsisten" : "Ada istilah yang bervariasi" };
      /* ----- variasi satuan ----- */
      var unitFound = [];
      WI_UNIT_VARIANTS.forEach(function(u){
        var short = 0, long = 0, firstIdx = Infinity;
        paras.forEach(function(P){
          P.toks.forEach(function(tok, ti){
            var low = tok.t.toLowerCase();
            if(wiInSpans(P.quotes, tok.start)) return;
            if(low === u.long) long++;
            var hitShort = false;
            if(u.kind === "token" && low === u.short) hitShort = true;
            else if(u.kind === "afterNumber" && low === u.short){
              var pv = P.toks[ti-1];
              if(pv && /^\d+$/.test(pv.t) && /^[ \t]+$/.test(P.text.slice(pv.end, tok.start))) hitShort = true;
            } else if(u.kind === "beforeNumber" && low === u.short){
              var nx2 = P.toks[ti+1];
              if(nx2 && /^\d+$/.test(nx2.t) && /^[ \t]+$/.test(P.text.slice(tok.end, nx2.start))) hitShort = true;
            }
            if(hitShort){ short++; if(P.offset + tok.start < firstIdx) firstIdx = P.offset + tok.start; }
          });
          if(u.kind === "symbol"){
            var re = /\d[ \t]*%/g, m;
            while((m = re.exec(P.text)) !== null){
              if(wiInSpans(P.quotes, m.index)) continue;
              short++;
              if(P.offset + m.index < firstIdx) firstIdx = P.offset + m.index;
            }
          }
        });
        if(short > 0 && long > 0) unitFound.push({ shortForm: u.short, longForm: u.long, short: short, long: long, idx: firstIdx });
      });
      /* ----- desimal campuran (koma vs titik) -----
         Pemisah ribuan (1.000) bukan desimal titik: pola /\d\.\d(?!\d)/
         sudah menolaknya, dan pemeriksaan eksplisit di bawah menegaskannya.
         Batas yang diketahui: string mirip versi ("versi 2.5") dapat tampak
         sebagai desimal titik. */
      var decComma = /\d+,\d+/.exec(norm), decDot = null;
      var reD = /\d\.\d(?!\d)/g, mD;
      while((mD = reD.exec(norm)) !== null){
        if(/\d\.\d{3}\b/.test(norm.slice(mD.index, mD.index + 5))) continue;
        decDot = mD; break;
      }
      /* ----- pengulangan frasa (3-gram dalam kalimat, >= 3 kali) ----- */
      var gramTotals = {}, gramFirst = {};
      paras.forEach(function(P){
        wiSentences(P.text, P.quotes).forEach(function(s){
          var g = wiGramCounts(P.text.slice(s.start, s.end), 3, s.start, P.quotes);
          g.order.forEach(function(key){
            gramTotals[key] = (gramTotals[key] || 0) + g.counts[key];
            if(gramFirst[key] === undefined) gramFirst[key] = P.offset + s.start;
          });
        });
      });
      var bestPhrase = null;
      Object.keys(gramTotals).forEach(function(key){
        if(gramTotals[key] < 3) return;
        if(!bestPhrase || gramTotals[key] > bestPhrase.count || (gramTotals[key] === bestPhrase.count && gramFirst[key] < gramFirst[bestPhrase.key]))
          bestPhrase = { key: key, count: gramTotals[key] };
      });
      /* ----- frasa birokratis & pola kata berlebih (untuk profil) ----- */
      function wiStyleScanPhrases(wordLists, skipParens){
        return wordLists.map(function(words){
          var cnt = 0, fIdx = Infinity, fEx = "";
          paras.forEach(function(P){
            wiStylePhraseHits(P, words, null).forEach(function(h){
              if(skipParens){
                var blocked = false;
                for(var t=h.i;t<=h.j;t++) if(wiInSpans(P.parens, P.toks[t].start)) blocked = true;
                if(blocked) return;
              }
              cnt++;
              var gi = P.offset + P.toks[h.i].start;
              if(gi < fIdx){ fIdx = gi; fEx = wiStyleExcerpt(P, h.i, h.j); }
            });
          });
          return { count: cnt, idx: fIdx, excerpt: fEx };
        });
      }
      var biroHits = wiStyleScanPhrases(WI_BIROKRASI.map(function(ph){ return ph.split(" "); }), false);
      var mubHits = wiStyleScanPhrases(WI_MUBAZIR.map(function(pat){ return pat.seq; }), true);
      /* ----- kalimat sangat panjang (untuk profil Ringkas) ----- */
      var longSents = [];
      paras.forEach(function(P){
        wiSentences(P.text, P.quotes).forEach(function(s){
          var txt = P.text.slice(s.start, s.end);
          var wc = wiTokens(txt).length;
          if(wc > 30) longSents.push({ idx: P.offset + s.start, words: wc, excerpt: txt.length > 90 ? txt.slice(0, 90) + "…" : txt });
        });
      });
      /* ----- temuan lingkup dokumen (berlaku untuk semua profil) ----- */
      var findings = [];
      function pronSummary(sets, scan){
        return sets.filter(function(s){ return scan.counts[s[0]] > 0; })
          .map(function(s){ return "“" + s[0] + "” " + scan.counts[s[0]] + " kali"; }).join(", ");
      }
      function pronFirstIdx(sets, scan){
        var m = Infinity;
        sets.forEach(function(s){ if(scan.counts[s[0]] > 0 && scan.first[s[0]] && scan.first[s[0]].idx < m) m = scan.first[s[0]].idx; });
        return m;
      }
      if(WI_PRON_SETS_1.filter(function(s){ return pron1.counts[s[0]] > 0; }).length >= 2)
        findings.push({ scope: "dokumen", kind: "sapaan-orang-pertama", certainty: "potensial",
          excerpt: pronSummary(WI_PRON_SETS_1, pron1),
          reason: "Dokumen memakai lebih dari satu kelompok kata ganti orang pertama di luar kutipan: " + pronSummary(WI_PRON_SETS_1, pron1) + ". Pergantian sapaan dapat disengaja — misalnya dalam narasi atau dialog — tetapi pada tulisan formal umumnya dipilih satu bentuk yang konsisten. Pemeriksa hanya mencocokkan kata, tidak menilai maksud penulis.",
          profile: null, idx: pronFirstIdx(WI_PRON_SETS_1, pron1) });
      if(WI_PRON_SETS_2.filter(function(s){ return pron2.counts[s[0]] > 0; }).length >= 2)
        findings.push({ scope: "dokumen", kind: "sapaan-orang-kedua", certainty: "potensial",
          excerpt: pronSummary(WI_PRON_SETS_2, pron2),
          reason: "Dokumen memakai lebih dari satu kelompok kata ganti orang kedua di luar kutipan: " + pronSummary(WI_PRON_SETS_2, pron2) + ". Pergantian sapaan dapat disengaja, tetapi konsistensi sapaan membantu pembaca memahami posisi penulis terhadapnya. Pemeriksa hanya mencocokkan kata, tidak menilai maksud penulis.",
          profile: null, idx: pronFirstIdx(WI_PRON_SETS_2, pron2) });
      termFound.forEach(function(tf){
        var list = tf.used.map(function(v){ return "“" + v + "” " + tf.counts[v] + " kali"; }).join(", ");
        findings.push({ scope: "dokumen", kind: "variasi-istilah", certainty: "potensial",
          excerpt: tf.excerpt,
          reason: "Istilah yang setara dipakai dalam beberapa variasi: " + list + ". Memilih satu variasi untuk seluruh dokumen memudahkan pembaca; variasi dapat saja disengaja bila konteksnya memang berbeda.",
          profile: null, idx: tf.idx });
      });
      unitFound.forEach(function(uf){
        findings.push({ scope: "dokumen", kind: "variasi-satuan", certainty: "potensial",
          excerpt: "“" + uf.shortForm + "” " + uf.short + " kali · “" + uf.longForm + "” " + uf.long + " kali",
          reason: "Satuan yang sama ditulis dalam dua bentuk: singkatan “" + uf.shortForm + "” dan bentuk panjang “" + uf.longForm + "”. Konsistensi penulisan satuan memudahkan pembaca membandingkan angka di seluruh dokumen.",
          profile: null, idx: uf.idx });
      });
      if(decComma && decDot)
        findings.push({ scope: "dokumen", kind: "desimal-campuran", certainty: "potensial",
          excerpt: decComma[0] + " · " + decDot[0],
          reason: "Dokumen memakai dua gaya penulisan desimal: koma (mis. “" + decComma[0] + "”) dan titik (mis. “" + decDot[0] + "”). Dalam Bahasa Indonesia, desimal baku memakai koma. Perlu diingat angka mirip versi perangkat lunak dapat tampak seperti desimal titik — periksa konteksnya sebelum menyimpulkan.",
          profile: null, idx: Math.min(decComma.index, decDot.index) });
      if(bestPhrase)
        findings.push({ scope: "dokumen", kind: "pengulangan-frasa", certainty: "gaya",
          excerpt: bestPhrase.key,
          reason: "Frasa “" + bestPhrase.key + "” muncul " + bestPhrase.count + " kali dalam dokumen. Pengulangan frasa yang sama dapat disengaja untuk penekanan atau karena frasa itu istilah baku; bila tidak disengaja, pertimbangkan variasi kata. Pemeriksa hanya menghitung pengulangan, tidak menilai makna.",
          profile: null, idx: gramFirst[bestPhrase.key] });
      /* ----- temuan lingkup profil (hanya profil yang dipilih) ----- */
      var pLabel = WI_STYLE_PROFILE_LABEL[prof];
      if(prof === "formal" || prof === "profesional" || prof === "akademik"){
        informalOrder.slice(0, 10).forEach(function(w){
          var e = informal[w];
          findings.push({ scope: "profil", kind: "kata-informal", certainty: "gaya",
            excerpt: e.excerpt,
            reason: "Kata “" + w + "” termasuk penanda ragam informal pada daftar kurasi Saksara (muncul " + e.count + " kali di luar kutipan), sedangkan profil acuan yang dipilih adalah " + pLabel + ". Ini saran gaya, bukan kesalahan — kata informal dapat disengaja, misalnya untuk dialog atau penekanan.",
            profile: prof, idx: e.idx });
        });
      }
      if(prof === "akademik"){
        [ ["aku", pron1, "aku"], ["kamu", pron2, "kamu"], ["gue/gua", pron1, "gue/gua"], ["lo/lu", pron2, "lo/lu"] ].forEach(function(cfg){
          var scan = cfg[1], key = cfg[2];
          if(scan.counts[key] > 0)
            findings.push({ scope: "profil", kind: "sapaan-akademik", certainty: "gaya",
              excerpt: scan.first[key].excerpt,
              reason: "Kata ganti “" + cfg[0] + "” dipakai " + scan.counts[key] + " kali di luar kutipan. Tulisan akademik umumnya memakai “saya”/“anda” atau bentuk pasif. Ini panduan gaya, bukan kesalahan.",
              profile: prof, idx: scan.first[key].idx });
        });
      }
      if(prof === "populer"){
        WI_BIROKRASI.forEach(function(ph, i){
          var h = biroHits[i];
          if(h.count > 0)
            findings.push({ scope: "profil", kind: "frasa-birokratis", certainty: "gaya",
              excerpt: h.excerpt,
              reason: "Frasa “" + ph + "” termasuk frasa birokratis yang kerap terasa berbelit bagi pembaca umum (muncul " + h.count + " kali). Pada profil Populer, pertimbangkan menulis maksudnya secara langsung bila sesuai dengan kalimatnya. Ini saran gaya, bukan kesalahan.",
              profile: prof, idx: h.idx });
        });
      }
      if(prof === "ringkas"){
        WI_MUBAZIR.forEach(function(pat, i){
          var h = mubHits[i];
          if(h.count > 0)
            findings.push({ scope: "profil", kind: "kata-mubazir", certainty: "gaya",
              excerpt: h.excerpt,
              reason: "Pola “" + pat.seq.join(" ") + "” termasuk kata berlebih yang terbukti; bentuk hematnya adalah “" + pat.repl + "” — disebutkan sebagai alternatif saja, teks tidak diubah otomatis.",
              profile: prof, idx: h.idx });
        });
        longSents.slice(0, 3).forEach(function(ls){
          findings.push({ scope: "profil", kind: "kalimat-panjang-ringkas", certainty: "gaya",
            excerpt: ls.excerpt,
            reason: "Kalimat ini berisi " + ls.words + " kata, di atas ambang 30 kata pada profil Ringkas. Kalimat panjang tidak otomatis buruk — periksa saja apakah isinya masih hemat dan jelas dalam sekali baca.",
            profile: prof, idx: ls.idx });
        });
      }
      // Urutan deterministik: dokumen dulu, lalu profil; di dalam lingkup
      // yang sama urut menurut jenis temuan, lalu posisi kemunculan pertama.
      findings.sort(function(a, b){
        var sa = a.scope === "dokumen" ? 0 : 1, sb = b.scope === "dokumen" ? 0 : 1;
        return sa - sb || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) || a.idx - b.idx;
      });
      S.findings = findings;
      return S;
    }
    /* WI-CORE-END */

    /* DI-CORE-START — Document Intelligence: model dokumen + impor DOCX.
       Fungsi murni (tanpa DOM, tanpa jaringan, tanpa penyimpanan), dapat
       diekstrak & diuji terpisah seperti blok inti lainnya. Satu-satunya
       kemampuan luar yang dipakai: dekompresi deflate lewat
       DecompressionStream bawaan peramban bila opts.inflateRaw tidak
       diberikan (pada pengujian Node, zlib disuntikkan lewat opts). */
    var DI_MAX_ANALYSIS_CHARS = 50000; /* sama dengan batas analisis WI yang sudah ada */
    var DI_CAPS = { maxEntries: 200, maxTotalBytes: 50 * 1024 * 1024, maxEntryBytes: 20 * 1024 * 1024 };
    function diFail(code, message){ return { ok: false, code: code, message: message }; }
    function diCapLabel(bytes){
      if(bytes >= 1048576) return Math.round(bytes / 1048576) + " MB";
      if(bytes >= 1024) return Math.round(bytes / 1024) + " KB";
      return bytes + " byte";
    }
    function diCapsWith(opts){
      var c = { maxEntries: DI_CAPS.maxEntries, maxTotalBytes: DI_CAPS.maxTotalBytes, maxEntryBytes: DI_CAPS.maxEntryBytes };
      if(opts && opts.caps){ for(var k in opts.caps){ if(typeof opts.caps[k] === "number" && opts.caps[k] > 0) c[k] = opts.caps[k]; } }
      return c;
    }
    /* ---------- ZIP: pembaca direktori pusat yang diperkeras ----------
       Batas: jumlah entri, ukuran total hasil dekompresi, ukuran per entri.
       Ditolak eksplisit: entri terenkripsi & arsip yang bergantung ZIP64. */
    function diZipRead(bytes, caps){
      if(!bytes || typeof bytes.length !== "number" || bytes.length < 22)
        return diFail("zip-invalid", "Berkas terlalu kecil untuk menjadi dokumen .docx yang valid.");
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var len = bytes.length, eocd = -1, i;
      var start = Math.max(0, len - 65557);
      for(i = len - 22; i >= start; i--){
        if(view.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
      }
      if(eocd < 0)
        return diFail("zip-invalid", "Berkas bukan dokumen .docx yang valid — struktur arsip ZIP tidak ditemukan. Pastikan berkas benar-benar dokumen Word (.docx), bukan .doc lama atau PDF.");
      if(eocd >= 20 && (view.getUint32(eocd - 20, true) === 0x07064b50 || view.getUint32(eocd - 20, true) === 0x06064b50))
        return diFail("zip64", "Dokumen memakai format ZIP64 yang belum didukung. Simpan ulang dokumen sebagai .docx biasa, lalu coba lagi.");
      var total = view.getUint16(eocd + 10, true);
      var cdSize = view.getUint32(eocd + 12, true);
      var cdOffset = view.getUint32(eocd + 16, true);
      if(total === 0xFFFF || cdSize === 0xFFFFFFFF || cdOffset === 0xFFFFFFFF)
        return diFail("zip64", "Dokumen memakai format ZIP64 yang belum didukung. Simpan ulang dokumen sebagai .docx biasa, lalu coba lagi.");
      if(total > caps.maxEntries)
        return diFail("zip-too-many-entries", "Dokumen memuat terlalu banyak bagian internal (" + total + " entri; batas " + caps.maxEntries + " entri).");
      var decoder = new TextDecoder("utf-8");
      var entries = [], pos = cdOffset, e;
      for(e = 0; e < total; e++){
        if(pos + 46 > len || view.getUint32(pos, true) !== 0x02014b50)
          return diFail("zip-invalid", "Struktur arsip dokumen rusak — direktori pusat tidak valid.");
        var flags = view.getUint16(pos + 8, true);
        if(flags & 0x0001)
          return diFail("zip-encrypted", "Dokumen terenkripsi atau dilindungi kata sandi sehingga tidak dapat dibaca.");
        var method = view.getUint16(pos + 10, true);
        var compSize = view.getUint32(pos + 20, true);
        var size = view.getUint32(pos + 24, true);
        if(compSize === 0xFFFFFFFF || size === 0xFFFFFFFF)
          return diFail("zip64", "Dokumen memakai format ZIP64 yang belum didukung. Simpan ulang dokumen sebagai .docx biasa, lalu coba lagi.");
        var nameLen = view.getUint16(pos + 28, true);
        var extraLen = view.getUint16(pos + 30, true);
        var commentLen = view.getUint16(pos + 32, true);
        var localOffset = view.getUint32(pos + 42, true);
        var name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
        if(localOffset + 30 > len || view.getUint32(localOffset, true) !== 0x04034b50)
          return diFail("zip-invalid", "Struktur arsip dokumen rusak — header lokal tidak valid.");
        var lNameLen = view.getUint16(localOffset + 26, true);
        var lExtraLen = view.getUint16(localOffset + 28, true);
        entries.push({ name: name, method: method, compSize: compSize, size: size, dataStart: localOffset + 30 + lNameLen + lExtraLen });
        pos += 46 + nameLen + extraLen + commentLen;
      }
      return { ok: true, entries: entries };
    }
    function diInflateRawDefault(data){
      var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Response(stream).arrayBuffer().then(function(ab){ return new Uint8Array(ab); });
    }
    function diZipExtract(bytes, entry, caps, inflateRaw){
      if(entry.method !== 0 && entry.method !== 8)
        return Promise.resolve(diFail("zip-method", "Bagian dokumen memakai metode kompresi yang tidak didukung (metode " + entry.method + ")."));
      if(entry.size > caps.maxEntryBytes)
        return Promise.resolve(diFail("zip-entry-too-large", "Satu bagian dokumen melebihi batas " + diCapLabel(caps.maxEntryBytes) + " setelah dibuka."));
      var raw = bytes.subarray(entry.dataStart, Math.min(bytes.length, entry.dataStart + entry.compSize));
      var job = entry.method === 0 ? Promise.resolve(raw)
        : Promise.resolve().then(function(){ return inflateRaw(raw); });
      return job.then(function(out){
        if(!out || typeof out.length !== "number")
          return diFail("zip-corrupt", "Isi dokumen tidak dapat dibuka.");
        if(out.length > caps.maxEntryBytes)
          return diFail("zip-entry-too-large", "Satu bagian dokumen melebihi batas " + diCapLabel(caps.maxEntryBytes) + " setelah dibuka.");
        return { ok: true, data: out };
      }).catch(function(){
        return diFail("zip-corrupt", "Isi dokumen rusak atau tidak dapat dibuka — berkas mungkin terpotong atau korup.");
      });
    }
    /* ---------- XML: parser kecil khusus (berjalan di peramban & Node) ----------
       Menghasilkan pohon elemen sederhana: { tag, local, attrs, children } —
       children berisi elemen atau simpul teks { text }. Pencocokan nama
       memakai nama lokal (sesudah prefiks namespace terakhir). */
    function diLocalName(tag){ var i = tag.lastIndexOf(":"); return i < 0 ? tag : tag.slice(i + 1); }
    function diChr(cp){
      if(!cp || cp < 0 || cp > 0x10FFFF) return "";
      try { return String.fromCodePoint(cp); } catch(e){ return ""; }
    }
    function diXmlUnescape(s){
      if(s.indexOf("&") < 0) return s;
      return s.replace(/&#x([0-9a-fA-F]+);/g, function(m, h){ return diChr(parseInt(h, 16)); })
        .replace(/&#(\d+);/g, function(m, d){ return diChr(parseInt(d, 10)); })
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
    }
    function diEscXmlText(s){ return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function diEscXmlAttr(s){ return diEscXmlText(s).replace(/"/g, "&quot;"); }
    function diSerializeXml(el){
      if(!el.tag) return diEscXmlText(el.text || "");
      var out = "<" + el.tag, k;
      for(k in el.attrs){ out += " " + k + "=\"" + diEscXmlAttr(el.attrs[k]) + "\""; }
      var kids = el.children || [];
      if(!kids.length) return out + "/>";
      out += ">";
      for(var i = 0; i < kids.length; i++) out += diSerializeXml(kids[i]);
      return out + "</" + el.tag + ">";
    }
    function diParseStartTag(inner){
      var sp = inner.search(/\s/);
      var name = sp < 0 ? inner : inner.slice(0, sp);
      var attrs = {};
      if(sp >= 0){
        var rest = inner.slice(sp);
        var re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g, m;
        while((m = re.exec(rest)) !== null){
          if(!m[1]) continue;
          attrs[m[1]] = diXmlUnescape(m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : ""));
        }
      }
      return { tag: name, local: diLocalName(name), attrs: attrs, children: [] };
    }
    function diParseXml(str){
      function fail(msg){ var e = new Error(msg); e.code = "xml-invalid"; throw e; }
      if(typeof str !== "string" || !str) fail("XML kosong.");
      var i = 0, n = str.length, stack = [], root = null;
      if(str.charCodeAt(0) === 0xFEFF) i = 1;
      function pushText(s){
        if(!s || !stack.length) return;
        stack[stack.length - 1].children.push({ text: s });
      }
      function attach(el){
        if(stack.length) stack[stack.length - 1].children.push(el);
        else if(!root) root = el;
        else fail("XML memiliki lebih dari satu elemen akar.");
      }
      function closeTag(name){
        var local = diLocalName(name);
        if(!stack.length) fail("Tag penutup tanpa pembuka: " + name);
        var top = stack.pop();
        if(top.local !== local) fail("Tag penutup tidak cocok: " + name);
      }
      while(i < n){
        if(str.charAt(i) === "<"){
          if(str.substr(i, 4) === "<!--"){ var e1 = str.indexOf("-->", i + 4); if(e1 < 0) fail("Komentar XML tidak tertutup."); i = e1 + 3; continue; }
          if(str.substr(i, 9) === "<![CDATA["){
            var e2 = str.indexOf("]]>", i + 9); if(e2 < 0) fail("CDATA tidak tertutup.");
            pushText(str.slice(i + 9, e2)); i = e2 + 3; continue;
          }
          if(str.substr(i, 2) === "<?"){ var e3 = str.indexOf("?>", i + 2); if(e3 < 0) fail("Instruksi XML tidak tertutup."); i = e3 + 2; continue; }
          if(str.substr(i, 2) === "<!"){ var e4 = str.indexOf(">", i + 2); if(e4 < 0) fail("Deklarasi XML tidak tertutup."); i = e4 + 1; continue; }
          if(str.substr(i, 2) === "</"){
            var e5 = str.indexOf(">", i + 2); if(e5 < 0) fail("Tag penutup tidak lengkap.");
            closeTag(str.slice(i + 2, e5).replace(/\s.*$/, "")); i = e5 + 1; continue;
          }
          var j = i + 1, quote = null;
          while(j < n){
            var ch = str.charAt(j);
            if(quote){ if(ch === quote) quote = null; }
            else if(ch === "\"" || ch === "'") quote = ch;
            else if(ch === ">") break;
            j++;
          }
          if(j >= n) fail("Tag pembuka tidak tertutup.");
          var inner = str.slice(i + 1, j), selfClose = false;
          if(/\/\s*$/.test(inner)){ selfClose = true; inner = inner.replace(/\/\s*$/, ""); }
          var el = diParseStartTag(inner);
          attach(el);
          if(!selfClose) stack.push(el);
          i = j + 1; continue;
        }
        var lt = str.indexOf("<", i); if(lt < 0) lt = n;
        pushText(diXmlUnescape(str.slice(i, lt)));
        i = lt;
      }
      if(stack.length) fail("XML tidak tertutup dengan benar.");
      if(!root) fail("XML tidak memiliki elemen akar.");
      return root;
    }
    function diKids(el, local){
      var out = [];
      (el.children || []).forEach(function(c){ if(c.tag && c.local === local) out.push(c); });
      return out;
    }
    function diFirst(el, local){
      if(!el) return null;
      var kids = el.children || [];
      for(var i = 0; i < kids.length; i++){ if(kids[i].tag && kids[i].local === local) return kids[i]; }
      return null;
    }
    function diAttr(el, name){
      if(!el || !el.attrs) return null;
      if(el.attrs[name] !== undefined) return el.attrs[name];
      for(var k in el.attrs){ if(diLocalName(k) === name) return el.attrs[k]; }
      return null;
    }
    function diDeepText(el){
      var out = "";
      (el.children || []).forEach(function(c){ out += c.tag ? diDeepText(c) : (c.text || ""); });
      return out;
    }
    function diCollectT(el){
      var out = "";
      (el.children || []).forEach(function(c){
        if(!c.tag) return;
        if(c.local === "t") out += diDeepText(c);
        else out += diCollectT(c);
      });
      return out;
    }
    /* ---------- Bagian pendamping DOCX: styles, numbering, rels ---------- */
    function diParseStyles(root){
      var map = {};
      if(!root) return map;
      diKids(root, "style").forEach(function(st){
        var id = diAttr(st, "styleId");
        if(!id) return;
        var nameEl = diFirst(st, "name");
        var rec = { name: nameEl ? diAttr(nameEl, "val") : null, outlineLvl: null };
        var pPr = diFirst(st, "pPr");
        if(pPr){
          var ol = diFirst(pPr, "outlineLvl");
          if(ol && diAttr(ol, "val") != null){
            var v = parseInt(diAttr(ol, "val"), 10);
            if(!isNaN(v)) rec.outlineLvl = v;
          }
        }
        map[id] = rec;
      });
      return map;
    }
    function diParseNumbering(root){
      if(!root) return null;
      var abs = {}, nums = {};
      diKids(root, "abstractNum").forEach(function(an){
        var aid = diAttr(an, "abstractNumId");
        if(aid == null) return;
        var lvls = {};
        diKids(an, "lvl").forEach(function(lv){
          var il = diAttr(lv, "ilvl");
          if(il == null) return;
          var nf = diFirst(lv, "numFmt");
          lvls[il] = nf ? diAttr(nf, "val") : null;
        });
        abs[aid] = lvls;
      });
      diKids(root, "num").forEach(function(nEl){
        var nid = diAttr(nEl, "numId");
        var aEl = diFirst(nEl, "abstractNumId");
        if(nid != null && aEl) nums[nid] = diAttr(aEl, "val");
      });
      return function(numId, ilvl){
        if(numId == null) return null;
        var aid = nums[String(numId)];
        if(aid == null) return null;
        var lvls = abs[aid];
        if(!lvls) return null;
        var f = lvls[String(ilvl)];
        if(f == null) f = lvls["0"];
        return f == null ? null : f;
      };
    }
    function diParseRels(root){
      var map = {};
      if(!root) return map;
      diKids(root, "Relationship").forEach(function(rel){
        var id = diAttr(rel, "Id"), target = diAttr(rel, "Target");
        if(id && target) map[id] = target;
      });
      return map;
    }
    /* ---------- DocModel: blok daun berurutan berisi run ----------
       Blok: { id, type: "paragraph"|"heading"|"list-item"|"table-cell", runs }
       heading: + level (1–6); list-item: + listKind "bullet"|"number", level;
       table-cell: + table, r, c, cellPara, gridSpan?, vMerge?.
       Run: { text, bold?, italic?, underline?, fontName?, fontSize?, link? }
       atau run terlindungi { text, protected: true, kind: "omml"|"field"|"object", xml }
       yang teksnya TIDAK ikut dirangkai menjadi teks analisis. */
    function diPushBlock(model, block){
      block.id = "b" + model.blocks.length;
      model.blocks.push(block);
      return block;
    }
    function diOnOff(rPr, name){
      var el = diFirst(rPr, name);
      if(!el) return false;
      var v = diAttr(el, "val");
      if(v == null) return true;
      v = String(v).toLowerCase();
      return !(v === "0" || v === "false" || v === "off" || v === "no");
    }
    function diRun(rEl, link){
      var text = "", field = false, object = false;
      var kids = rEl.children || [];
      for(var i = 0; i < kids.length; i++){
        var ch = kids[i];
        if(!ch.tag) continue;
        var ln = ch.local;
        if(ln === "t") text += diDeepText(ch);
        else if(ln === "tab") text += "\t";
        else if(ln === "br" || ln === "cr") text += "\n";
        else if(ln === "noBreakHyphen") text += "‑";
        else if(ln === "softHyphen") text += "­";
        else if(ln === "sym"){
          var hex = diAttr(ch, "char");
          if(hex){ var cp = parseInt(hex, 16); if(!isNaN(cp)) text += diChr(cp); }
        }
        else if(ln === "fldChar" || ln === "instrText") field = true;
        else if(ln === "drawing" || ln === "pict" || ln === "object") object = true;
      }
      if(field) return { text: text, protected: true, kind: "field", xml: diSerializeXml(rEl) };
      if(object && !text) return { text: "", protected: true, kind: "object", xml: diSerializeXml(rEl) };
      if(!text) return null;
      var run = { text: text };
      var rPr = diFirst(rEl, "rPr");
      if(rPr){
        if(diOnOff(rPr, "b") || diOnOff(rPr, "bCs")) run.bold = true;
        if(diOnOff(rPr, "i") || diOnOff(rPr, "iCs")) run.italic = true;
        var u = diFirst(rPr, "u");
        if(u){
          var uv = diAttr(u, "val");
          if(uv !== "none"){ run.underline = true; if(uv && uv !== "single") run.underlineStyle = uv; }
        }
        var fonts = diFirst(rPr, "rFonts");
        if(fonts){
          var fn = diAttr(fonts, "ascii") || diAttr(fonts, "hAnsi") || diAttr(fonts, "eastAsia") || diAttr(fonts, "cs");
          if(fn) run.fontName = fn;
        }
        var sz = diFirst(rPr, "sz") || diFirst(rPr, "szCs");
        if(sz){ var sv = parseFloat(diAttr(sz, "val")); if(!isNaN(sv)) run.fontSize = sv / 2; }
      }
      if(link) run.link = link;
      return run;
    }
    var DI_SKIP_RUN_PARENT = { pPr: 1, rPr: 1, del: 1, moveFrom: 1, bookmarkStart: 1, bookmarkEnd: 1, proofErr: 1, commentRangeStart: 1, commentRangeEnd: 1, permStart: 1, permEnd: 1 };
    function diWalkRuns(el, ctx, state, out){
      var kids = el.children || [];
      for(var i = 0; i < kids.length; i++){
        var ch = kids[i];
        if(!ch.tag) continue;
        var ln = ch.local;
        if(DI_SKIP_RUN_PARENT[ln]) continue; /* termasuk w:del — teks terhapus (track changes) tidak ikut */
        if(ln === "r"){ var run = diRun(ch, state.link); if(run) out.push(run); continue; }
        if(ln === "hyperlink"){
          var rid = diAttr(ch, "id");
          var target = rid && ctx.rels[rid] ? ctx.rels[rid] : null;
          diWalkRuns(ch, ctx, { link: target }, out);
          continue;
        }
        if(ln === "fldSimple"){
          out.push({ text: diCollectT(ch), protected: true, kind: "field", xml: diSerializeXml(ch) });
          continue;
        }
        if(ln === "oMath" || ln === "oMathPara"){
          out.push({ text: diCollectT(ch), protected: true, kind: "omml", xml: diSerializeXml(ch) });
          continue;
        }
        diWalkRuns(ch, ctx, state, out); /* wadah transparan: ins, smartTag, sdt, customXml, txbxContent, moveTo */
      }
    }
    function diParaBlock(pEl, ctx, cellCtx){
      var pPr = diFirst(pEl, "pPr");
      var block = { type: "paragraph", runs: [] };
      var styleName = null, headingLevel = 0, listInfo = null;
      if(pPr){
        var pStyle = diFirst(pPr, "pStyle");
        var styleId = pStyle ? diAttr(pStyle, "val") : null;
        var st = styleId ? ctx.styles[styleId] : null;
        if(st) styleName = st.name;
        var ol = diFirst(pPr, "outlineLvl");
        var olv = ol ? parseInt(diAttr(ol, "val"), 10) : NaN;
        if(!isNaN(olv) && olv >= 0) headingLevel = olv + 1;
        else if(st){
          if(st.outlineLvl != null && st.outlineLvl >= 0) headingLevel = st.outlineLvl + 1;
          else {
            var m = /^(?:heading|judul)\s*([1-9])$/i.exec((st.name || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, ""))
              || /^heading\s?([1-9])$/i.exec(styleId || "");
            if(m) headingLevel = parseInt(m[1], 10);
          }
        }
        var numPr = diFirst(pPr, "numPr");
        if(numPr){
          var ilvlEl = diFirst(numPr, "ilvl"), numIdEl = diFirst(numPr, "numId");
          var ilvl = ilvlEl && diAttr(ilvlEl, "val") != null ? parseInt(diAttr(ilvlEl, "val"), 10) : 0;
          if(isNaN(ilvl)) ilvl = 0;
          var numId = numIdEl ? diAttr(numIdEl, "val") : null;
          var fmt = ctx.numbering ? ctx.numbering(numId, ilvl) : null;
          if(fmt !== "none")
            listInfo = { kind: fmt === "bullet" ? "bullet" : (fmt ? "number" : "bullet"), level: ilvl, numId: numId };
        }
        var jc = diFirst(pPr, "jc");
        if(jc && diAttr(jc, "val")) block.align = diAttr(jc, "val");
        var ind = diFirst(pPr, "ind");
        if(ind){
          var indObj = {}, hasInd = false;
          ["left", "right", "firstLine", "hanging"].forEach(function(k){
            var v = diAttr(ind, k);
            if(v != null){ var iv = parseInt(v, 10); if(!isNaN(iv)){ indObj[k] = iv; hasInd = true; } }
          });
          if(hasInd) block.indent = indObj;
        }
      }
      if(styleName) block.styleName = styleName;
      diWalkRuns(pEl, ctx, { link: null }, block.runs);
      if(cellCtx){
        block.type = "table-cell";
        block.table = cellCtx.table; block.r = cellCtx.r; block.c = cellCtx.c; block.cellPara = cellCtx.cellPara;
        if(cellCtx.gridSpan > 1) block.gridSpan = cellCtx.gridSpan;
        if(cellCtx.vMerge) block.vMerge = cellCtx.vMerge;
      } else if(headingLevel > 0){
        block.type = "heading"; block.level = Math.min(6, headingLevel);
      } else if(listInfo){
        block.type = "list-item"; block.listKind = listInfo.kind; block.level = listInfo.level;
        if(listInfo.numId != null) block.numId = listInfo.numId;
      }
      /* D4.1 (F5): styleId hanya dicatat pada blok heading — detektor
         nama gaya kustom membutuhkan identitas gaya yang tidak ambigu
         (styleName saja dapat berarti bawaan terlokalisasi). */
      if(block.type === "heading" && styleId) block.styleId = styleId;
      return block;
    }
    function diTableBlock(tblEl, ctx, model, probe){
      var tIdx = model.tables.length;
      var table = { index: tIdx, rows: [] };
      model.tables.push(table);
      diKids(tblEl, "tr").forEach(function(tr, r){
        var rowMeta = { cells: [] };
        var col = 0;
        diKids(tr, "tc").forEach(function(tc){
          var tcPr = diFirst(tc, "tcPr");
          var gridSpan = 1, vMerge = null;
          if(tcPr){
            var gs = diFirst(tcPr, "gridSpan");
            if(gs && diAttr(gs, "val")){ var gv = parseInt(diAttr(gs, "val"), 10); if(!isNaN(gv) && gv > 1) gridSpan = gv; }
            var vm = diFirst(tcPr, "vMerge");
            if(vm) vMerge = diAttr(vm, "val") === "restart" ? "restart" : "continue";
          }
          var cellMeta = { r: r, c: col, gridSpan: gridSpan, vMerge: vMerge, blockIds: [] };
          var cellPara = 0;
          (tc.children || []).forEach(function(ch){
            if(!ch.tag) return;
            if(ch.local === "p"){
              var b = diParaBlock(ch, ctx, { table: tIdx, r: r, c: col, cellPara: cellPara, gridSpan: gridSpan, vMerge: vMerge });
              diPushBlock(model, b);
              cellMeta.blockIds.push(b.id);
              cellPara++;
            } else if(ch.local === "tbl"){
              /* D4.1 (F3): tabel di dalam sel — diratakan oleh pemanggilan
                 rekursif ini; kejadiannya dihitung untuk peringatan. */
              if(probe) probe.nestedTables++;
              diTableBlock(ch, ctx, model, probe);
            }
          });
          rowMeta.cells.push(cellMeta);
          col += gridSpan;
        });
        table.rows.push(rowMeta);
      });
    }
    function diWalkBody(kids, ctx, model, probe){
      (kids || []).forEach(function(el){
        if(!el.tag) return;
        if(el.local === "p") diPushBlock(model, diParaBlock(el, ctx, null));
        else if(el.local === "tbl") diTableBlock(el, ctx, model, probe);
        else if(el.local === "sdt"){
          var content = diFirst(el, "sdtContent");
          if(content) diWalkBody(content.children, ctx, model, probe);
        }
      });
    }
    /* D4.1 (F7): pemindaian struktural pohon document.xml untuk
       pemberitahuan impor. Hanya NAMA elemen yang diperiksa, tidak
       pernah teks: ins/del/moveFrom/moveTo menandai track changes,
       commentReference menandai adanya komentar yang dirujuk isi,
       footnoteReference menandai adanya catatan kaki yang dirujuk isi. */
    function diScanPartFlags(el, out){
      out = out || { trackedChanges: false, commentRefs: false, footnoteRefs: false };
      if(!el || !el.tag) return out;
      var ln = el.local;
      if(ln === "ins" || ln === "del" || ln === "moveFrom" || ln === "moveTo") out.trackedChanges = true;
      else if(ln === "commentReference") out.commentRefs = true;
      else if(ln === "footnoteReference") out.footnoteRefs = true;
      (el.children || []).forEach(function(c){ if(c.tag) diScanPartFlags(c, out); });
      return out;
    }
    function diBuildModel(docRoot, ctx){
      var model = { format: "docx", blocks: [], tables: [] };
      var body = diFirst(docRoot, "body") || docRoot;
      var probe = { nestedTables: 0 };
      diWalkBody(body.children, ctx, model, probe);
      /* D4.1: flag impor dicatat HANYA bila kondisinya terdeteksi —
         dokumen tanpa kondisi apa pun tidak membawa kunci flags,
         sehingga modelnya sama persis dengan keadaan sebelumnya. */
      var scan = diScanPartFlags(docRoot);
      var flags = {};
      if(probe.nestedTables > 0) flags.nestedTables = probe.nestedTables;
      if(scan.trackedChanges) flags.trackedChanges = true;
      if(scan.footnoteRefs) flags.footnotes = true;
      if(scan.commentRefs) flags.comments = true;
      if(Object.keys(flags).length) model.flags = flags;
      return model;
    }
    /* ---------- Perakitan teks analisis + statistik ----------
       Pilihan desain (D1): run terlindungi TIDAK menyumbang karakter apa pun
       ke teks analisis — tidak ada placeholder — agar teks yang dianalisis
       persis teks dokumen yang terbaca; elemen terlindungi hanya dihitung
       pada statistik. Blok tanpa teks terbaca tidak menjadi paragraf analisis. */
    function diBlockText(block){
      var out = "";
      (block.runs || []).forEach(function(r){ if(!r.protected) out += r.text; });
      return out;
    }
    function diAssembleText(model){
      var eligible = [];
      (model.blocks || []).forEach(function(b, i){
        var t = diBlockText(b);
        if(t && t.replace(/\s+/g, "")) eligible.push({ idx: i, text: t });
      });
      var totalChars = 0;
      eligible.forEach(function(e, i){ totalChars += e.text.length + (i > 0 ? 2 : 0); });
      var paras = [], paraMap = [], cur = 0, truncated = false;
      for(var i = 0; i < eligible.length; i++){
        var need = eligible[i].text.length + (paras.length > 0 ? 2 : 0);
        if(cur + need > DI_MAX_ANALYSIS_CHARS){ truncated = true; break; }
        paras.push(eligible[i].text); paraMap.push(eligible[i].idx); cur += need;
      }
      if(eligible.length > paras.length) truncated = true;
      return { text: paras.join("\n\n"), paraMap: paraMap, truncated: truncated, keptBlocks: paras.length, totalBlocks: eligible.length, totalChars: totalChars };
    }
    function diModelStats(model){
      var stats = { blocks: 0, paragraphs: 0, headings: 0, listItems: 0, cells: 0, tables: (model.tables || []).length, words: 0, chars: 0, protected: 0 };
      if(model && typeof model.pages === "number") stats.pages = model.pages; /* D2: hanya model PDF yang membawa jumlah halaman; model DOCX tidak berubah */
      (model.blocks || []).forEach(function(b){
        stats.blocks++;
        if(b.type === "heading") stats.headings++;
        else if(b.type === "list-item") stats.listItems++;
        else if(b.type === "table-cell") stats.cells++;
        else stats.paragraphs++;
        (b.runs || []).forEach(function(r){
          if(r.protected){ stats.protected++; return; }
          stats.chars += r.text.length;
          var m = r.text.match(/[\p{L}\p{N}]+/gu);
          if(m) stats.words += m.length;
        });
      });
      return stats;
    }
    /* ---------- Pintu masuk: parse berkas .docx menjadi DocModel ----------
       Mengembalikan Promise<{ ok: true, model } | { ok: false, code, message }>.
       Validasi berdasar ISI: struktur ZIP + bagian wajib DOCX, bukan ekstensi. */
    function diParseDocx(bytes, opts){
      opts = opts || {};
      var caps = diCapsWith(opts);
      var inflateRaw = typeof opts.inflateRaw === "function" ? opts.inflateRaw : diInflateRawDefault;
      var zr = diZipRead(bytes, caps);
      if(!zr.ok) return Promise.resolve(zr);
      var byName = {};
      zr.entries.forEach(function(en){ byName[en.name] = en; });
      if(!byName["[Content_Types].xml"])
        return Promise.resolve(diFail("docx-no-content-types", "Berkas bukan dokumen .docx yang valid — bagian [Content_Types].xml tidak ditemukan."));
      if(!byName["word/document.xml"])
        return Promise.resolve(diFail("docx-no-document", "Berkas bukan dokumen Word yang didukung — isi utama dokumen (word/document.xml) tidak ditemukan."));
      var totalOut = 0;
      function getPart(name){
        var en = byName[name];
        if(!en) return Promise.resolve(null);
        if(totalOut + en.size > caps.maxTotalBytes)
          return Promise.resolve(diFail("zip-too-large", "Total isi dokumen setelah dibuka melebihi batas " + diCapLabel(caps.maxTotalBytes) + "."));
        return diZipExtract(bytes, en, caps, inflateRaw).then(function(r){
          if(!r.ok) return r;
          totalOut += r.data.length;
          if(totalOut > caps.maxTotalBytes)
            return diFail("zip-too-large", "Total isi dokumen setelah dibuka melebihi batas " + diCapLabel(caps.maxTotalBytes) + ".");
          return { ok: true, text: new TextDecoder("utf-8").decode(r.data) };
        });
      }
      var parts = {};
      var chain = getPart("word/document.xml").then(function(r){ parts.document = r; });
      ["word/styles.xml", "word/numbering.xml", "word/_rels/document.xml.rels"].forEach(function(name){
        chain = chain.then(function(){
          if(parts.error || (parts.document && !parts.document.ok)) return null;
          return getPart(name).then(function(r){
            if(r && !r.ok) parts.error = r;
            else if(r) parts[name] = r.text;
          });
        });
      });
      return chain.then(function(){
        if(parts.document && !parts.document.ok) return parts.document;
        if(parts.error) return parts.error;
        if(!parts.document) return diFail("docx-no-document", "Isi utama dokumen tidak dapat dibaca.");
        try {
          var docRoot = diParseXml(parts.document.text);
          var styles = {}, numbering = null, rels = {};
          if(parts["word/styles.xml"]){ try { styles = diParseStyles(diParseXml(parts["word/styles.xml"])); } catch(e){ styles = {}; } }
          if(parts["word/numbering.xml"]){ try { numbering = diParseNumbering(diParseXml(parts["word/numbering.xml"])); } catch(e){ numbering = null; } }
          if(parts["word/_rels/document.xml.rels"]){ try { rels = diParseRels(diParseXml(parts["word/_rels/document.xml.rels"])); } catch(e){ rels = {}; } }
          var model = diBuildModel(docRoot, { styles: styles, numbering: numbering, rels: rels });
          /* D4.1 (F7): lengkapi flag impor dari bagian pendamping.
             Pengambilan footnotes/comments bersifat TOLERAN — kegagalan
             membaca bagian pendamping tidak pernah menggagalkan impor;
             flag-nya saja yang tidak terpasang. Header/footer dideteksi
             dari nama entri pada peta ZIP. Catatan kaki hanya dihitung
             bila ada entri sungguhan (bukan separator struktural). */
          var extra = [];
          if(byName["word/footnotes.xml"]) extra.push(getPart("word/footnotes.xml").then(function(r){ if(r && r.ok) parts.footnotesText = r.text; }));
          if(byName["word/comments.xml"]) extra.push(getPart("word/comments.xml").then(function(r){ if(r && r.ok) parts.commentsText = r.text; }));
          return Promise.all(extra).then(function(){
            var flags = model.flags || {};
            if(Object.keys(byName).some(function(n){ return /^word\/(?:header|footer)\d*\.xml$/.test(n); }))
              flags.headerFooter = true;
            if(parts.footnotesText){
              try {
                var fnReal = 0;
                diKids(diParseXml(parts.footnotesText), "footnote").forEach(function(fn){
                  var t = diAttr(fn, "type");
                  if(t !== "separator" && t !== "continuationSeparator" && t !== "continuationNotice") fnReal++;
                });
                if(fnReal > 0) flags.footnotes = true;
              } catch(e){ /* bagian rusak diperlakukan sebagai tidak ada */ }
            }
            if(parts.commentsText){
              try {
                if(diKids(diParseXml(parts.commentsText), "comment").length > 0) flags.comments = true;
              } catch(e){ /* bagian rusak diperlakukan sebagai tidak ada */ }
            }
            if(Object.keys(flags).length) model.flags = flags;
            return { ok: true, model: model };
          });
        } catch(err){
          if(err && err.code === "xml-invalid")
            return diFail("xml-invalid", "Isi dokumen tidak dapat dibaca — struktur XML di dalamnya rusak.");
          return diFail("parse-error", "Dokumen tidak dapat dibaca.");
        }
      });
    }
    /* ---------- PDF: konversi item teks pdf.js menjadi DocModel (D2) ----------
       Lapisan lem pdf.js hidup di lapisan UI; DI-CORE hanya menerima data
       item yang sudah dinormalisasi:
         pages = [{ page, items: [{ str, x, y, width, fontName, fontSize }] }]
       x/y adalah posisi baseline item (transform pdf.js); y BERTAMBAH ke
       atas sesuai konvensi PDF dan dinormalisasi di sini menjadi urutan
       baca (halaman menaik, atas ke bawah, kiri ke kanan).
       Keputusan desain:
       - Semua blok bertipe "paragraph" dan membawa nomor halaman (page).
         PDF tidak menyimpan struktur semantik, jadi TIDAK ada klaim
         heading dari ukuran huruf — menebak judul dari geometri akan
         mengarang struktur yang tidak ada di berkas.
       - bold/italic hanyalah heuristik nama font (mengandung "Bold" /
         "Italic" / "Oblique"). fontName adalah nama keluarga font menurut
         pdf.js (dapat memuat prefiks subset seperti "ABCDEE+"), bukan
         gaya tertanam: format hasil PDF selalu bersifat perkiraan.
       - Pengelompokan baris murni geometris (kedekatan y, toleransi
         sebagian ukuran font). Dokumen dua kolom terbaca menyilang per
         baris — batas yang diketahui dan didokumentasikan.
       - Paragraf dipisah oleh jarak vertikal > 1,5x tinggi baris
         sebelumnya; baris di dalam paragraf disambung dengan satu spasi
         (kecuali sesudah tanda hubung di akhir baris). */
    function diSniffFormat(bytes){
      if(!bytes || typeof bytes.length !== "number" || bytes.length < 4) return "unknown";
      if(bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return "zip";
      var lim = Math.min(bytes.length, 1024);
      for(var i = 0; i + 4 <= lim; i++){
        if(bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) return "pdf";
      }
      return "unknown";
    }
    function diPdfFontFlags(fontName){
      var n = String(fontName || "");
      return { bold: /bold/i.test(n), italic: /italic|oblique/i.test(n) };
    }
    function diPdfItemSize(it){
      return (it && typeof it.fontSize === "number" && it.fontSize > 0) ? it.fontSize : 12;
    }
    function diPdfSameRun(a, b){
      return !!a && !!b && !a.protected && !b.protected &&
        a.bold === b.bold && a.italic === b.italic &&
        a.fontName === b.fontName && a.fontSize === b.fontSize;
    }
    function diPdfLineRuns(items){
      /* items = item-item satu baris yang sudah terurut x menaik.
         Item berfont sama & berdekatan digabung menjadi satu run; celah
         lebar di antara dua item menjadi satu spasi. */
      var runs = [], prev = null;
      items.forEach(function(it){
        var size = diPdfItemSize(it);
        var flags = diPdfFontFlags(it.fontName);
        var run = { text: String(it.str) };
        if(it.fontName) run.fontName = String(it.fontName);
        run.fontSize = Math.round(size * 10) / 10;
        if(flags.bold) run.bold = true;
        if(flags.italic) run.italic = true;
        var x = typeof it.x === "number" ? it.x : 0;
        var w = typeof it.width === "number" ? it.width : 0;
        if(prev){
          var gap = x - (prev.x + prev.width);
          var space = gap > 0.22 * size && !/\s$/.test(prev.run.text) && !/^\s/.test(run.text);
          if(diPdfSameRun(prev.run, run)){
            if(space) prev.run.text += " ";
            prev.run.text += run.text;
            prev.x = x; prev.width = w;
            return;
          }
          if(space) run.text = " " + run.text;
        }
        runs.push(run);
        prev = { x: x, width: w, run: run };
      });
      return runs;
    }
    function diPdfPageLines(items){
      var deco = [];
      (items || []).forEach(function(it, i){
        if(!it || typeof it.str !== "string" || !it.str.length) return;
        deco.push({ it: it, idx: i, x: typeof it.x === "number" ? it.x : 0,
          y: typeof it.y === "number" ? it.y : 0, size: diPdfItemSize(it) });
      });
      deco.sort(function(a, b){ return (b.y - a.y) || (a.x - b.x) || (a.idx - b.idx); });
      var lines = [];
      deco.forEach(function(d){
        var line = lines[lines.length - 1];
        var tol = line ? Math.max(1.25, 0.45 * Math.min(d.size, line.size)) : 0;
        if(line && Math.abs(d.y - line.y) <= tol){
          line.items.push(d);
          if(d.size > line.size) line.size = d.size;
        } else {
          lines.push({ y: d.y, size: d.size, items: [d] });
        }
      });
      return lines.map(function(line){
        var sorted = line.items.slice().sort(function(a, b){ return (a.x - b.x) || (a.idx - b.idx); });
        return { y: line.y, height: line.size,
          runs: diPdfLineRuns(sorted.map(function(d){ return d.it; })) };
      });
    }
    function diPdfAppendRun(runs, run, spaceBefore){
      if(!run || !run.text) return;
      var last = runs[runs.length - 1];
      if(last && spaceBefore && !/[\s\-]$/.test(last.text) && !/^\s/.test(run.text)){
        if(diPdfSameRun(last, run)){ last.text += " " + run.text; return; }
        runs.push({ text: " " });
        last = runs[runs.length - 1];
      }
      if(last && diPdfSameRun(last, run)){ last.text += run.text; return; }
      var copy = { text: run.text };
      if(run.fontName) copy.fontName = run.fontName;
      if(typeof run.fontSize === "number") copy.fontSize = run.fontSize;
      if(run.bold) copy.bold = true;
      if(run.italic) copy.italic = true;
      runs.push(copy);
    }
    function diPdfPagesToModel(pages){
      var model = { format: "pdf", blocks: [], tables: [], pages: Array.isArray(pages) ? pages.length : 0 };
      (pages || []).forEach(function(pg, pi){
        var pageNo = (pg && typeof pg.page === "number") ? pg.page : pi + 1;
        var lines = diPdfPageLines(pg ? pg.items : []);
        var curRuns = null, lastY = 0, lastHeight = 0;
        function flush(){
          if(curRuns && curRuns.some(function(r){ return /\S/.test(r.text); }))
            diPushBlock(model, { type: "paragraph", page: pageNo, runs: curRuns });
          curRuns = null;
        }
        lines.forEach(function(line){
          if(!line.runs.length) return;
          if(curRuns && (lastY - line.y) > 1.5 * lastHeight) flush();
          if(!curRuns) curRuns = [];
          line.runs.forEach(function(run, ri){
            diPdfAppendRun(curRuns, run, ri === 0 && curRuns.length > 0);
          });
          lastY = line.y; lastHeight = line.height;
        });
        flush();
      });
      return model;
    }
    /* Statistik lapisan teks PDF untuk deteksi pindaian: karakter yang
       dihitung adalah karakter bukan-spasi dari seluruh item. PDF disebut
       mirip pindaian bila totalnya 0, atau rata-rata per halaman < 10 —
       ambang untuk peringatan jujur "butuh OCR" di lapisan UI. */
    function diPdfTextStats(pages){
      var per = [], total = 0, empty = 0;
      (pages || []).forEach(function(pg){
        var n = 0;
        ((pg && pg.items) || []).forEach(function(it){
          if(it && typeof it.str === "string") n += it.str.replace(/\s+/g, "").length;
        });
        per.push(n); total += n; if(n === 0) empty++;
      });
      return { pages: per.length, totalChars: total, emptyPages: empty, charsPerPage: per,
        scanLike: total === 0 || (per.length > 0 && total / per.length < 10) };
    }
    /* Pemetaan galat pdf.js menjadi kode + pesan terstruktur (Bahasa
       Indonesia). Menerima objek mirip galat { name, message } agar dapat
       diuji tanpa pdf.js. Pesan mentah tidak pernah ditampilkan ke
       pengguna — lapisan UI mencatatnya ke konsol saja. */
    function diPdfErrorInfo(err){
      var name = (err && typeof err.name === "string") ? err.name : "";
      var msg = (err && typeof err.message === "string") ? err.message : (typeof err === "string" ? err : "");
      if(name === "PasswordException" || /password/i.test(name))
        return { code: "pdf-encrypted", message: "PDF terenkripsi atau dilindungi kata sandi sehingga tidak dapat dibuka. Simpan ulang berkas tanpa perlindungan kata sandi, lalu coba lagi." };
      if(name === "InvalidPDFException" || name === "MissingPDFException" || /invalid pdf/i.test(msg))
        return { code: "pdf-invalid", message: "Berkas bukan PDF yang valid atau isinya rusak sehingga tidak dapat dibuka. Pastikan berkas benar-benar PDF yang utuh, lalu coba lagi." };
      return { code: "pdf-failed", message: "PDF tidak dapat dibaca — berkas mungkin rusak atau memakai fitur yang belum didukung." };
    }
    /* ---------- D3: sinkronisasi model ↔ teks analisis ----------
       WI-CORE hanya mengenal teks + offset per paragraf. Bagian ini
       menyelaraskan paragraf hasil analisis dengan blok dokumen secara
       KONSERVATIF: sebuah paragraf hanya dinyatakan "matched" bila
       teksnya PERSIS sama dengan teks satu blok, dicari berurutan dari
       posisi terakhir yang cocok (satu blok tidak dipakai dua kali).
       Paragraf yang tidak ditemukan persis adalah "edited" — disunting
       manual atau memang berbeda dari dokumen — dan sarannya tidak
       pernah diterapkan ke dokumen. Jalur cepat: bila teks yang
       dianalisis adalah hasil diAssembleText yang tidak diubah, hasil
       penyelarasan sama persis dengan paraMap rakitan itu. */
    function diTextBlocks(model){
      var out = [];
      (model.blocks || []).forEach(function(b, i){
        var t = diBlockText(b);
        if(t && t.replace(/\s+/g, "")) out.push({ blockIdx: i, text: t });
      });
      return out;
    }
    function diSyncModel(model, analyzed){
      var paras, i;
      if(Array.isArray(analyzed)){
        paras = analyzed.map(function(p){ return String(p == null ? "" : p); });
      } else {
        /* Pecah dengan konvensi yang sama seperti wiSplitParas WI-CORE
           (pemisah baris kosong), sesudah normalisasi CRLF yang sama
           seperti wiAnalyze. */
        var norm = String(analyzed == null ? "" : analyzed).replace(/\r\n?/g, "\n");
        var parts = norm.split(/(\n[ \t]*\n(?:[ \t]*\n)*)/);
        paras = [];
        for(i = 0; i < parts.length; i += 2) paras.push(parts[i]);
      }
      var tb = diTextBlocks(model);
      var align = [], cursor = 0;
      paras.forEach(function(p){
        if(!p || !/\S/.test(p)){ align.push({ status: "empty", blockIdx: -1 }); return; }
        var found = -1;
        for(var j = cursor; j < tb.length; j++){ if(tb[j].text === p){ found = j; break; } }
        if(found >= 0){ align.push({ status: "matched", blockIdx: tb[found].blockIdx }); cursor = found + 1; }
        else align.push({ status: "edited", blockIdx: -1 });
      });
      return { paragraphs: paras, align: align, textBlocks: tb.length };
    }
    /* ---------- D3: pemetaan saran → span dokumen ----------
       Saran WI membawa (pIdx, start, end, original, replacement) dalam
       koordinat paragraf. Pemetaan mengembalikannya ke (blok, run,
       offset-di-dalam-run). Status "applicable" HANYA bila seluruh
       rentang berada di dalam SATU run yang tidak terlindungi dan teks
       blok pada rentang itu persis sama dengan `original` saran.
       Alasan "cross-block" ada di taksonomi untuk kelengkapan: dengan
       kontrak WI saat ini satu saran selalu berada di dalam satu
       paragraf = satu blok, jadi alasan itu tidak dapat muncul; semua
       kegagalan lintas batas muncul sebagai cross-run/protected. */
    var DI_MAP_REASON_TEXT = {
      "manual-edit": "paragraf ini berubah dari dokumen aslinya (kemungkinan disunting manual)",
      "cross-run": "saran melintasi batas potongan teks (run) di dalam dokumen",
      "protected": "saran menyentuh elemen terlindungi (rumus/kolom isian/gambar) yang tidak pernah diubah",
      "text-mismatch": "teks dokumen pada posisi ini tidak sama dengan teks yang dianalisis",
      "cross-block": "saran melintasi lebih dari satu blok dokumen",
      "no-block": "paragraf ini tidak ditemukan pada dokumen yang dimuat"
    };
    function diMapReadonly(reason){
      return { status: "readonly", reason: reason, reasonText: DI_MAP_REASON_TEXT[reason] || reason };
    }
    function diMapSuggestion(model, sync, s){
      if(!s || s.advisory || typeof s.replacement !== "string")
        return { status: "advisory" };
      var a = sync && sync.align ? sync.align[s.pIdx] : null;
      if(!a || a.status === "empty") return diMapReadonly("no-block");
      if(a.status === "edited") return diMapReadonly("manual-edit");
      var block = (model.blocks || [])[a.blockIdx];
      if(!block) return diMapReadonly("no-block");
      if(diBlockText(block).slice(s.start, s.end) !== s.original)
        return diMapReadonly("text-mismatch");
      /* Telusuri run dalam koordinat teks blok. Offset hanya dihitung
         dari run TIDAK terlindungi (teks run terlindungi tidak masuk
         teks analisis — keputusan D1); posisi run terlindungi dicatat
         untuk mendeteksi rentang yang melintasinya. */
      var pos = 0, startRun = -1, endRun = -1, protInside = false, spans = {};
      var runs = block.runs || [];
      for(var ri = 0; ri < runs.length; ri++){
        var r = runs[ri];
        if(r.protected){
          if(pos > s.start && pos < s.end) protInside = true;
          continue;
        }
        var rs = pos, re = pos + r.text.length;
        spans[ri] = { start: rs, end: re };
        if(s.start >= rs && s.start < re) startRun = ri;
        if(s.end > rs && s.end <= re) endRun = ri;
        pos = re;
      }
      if(protInside) return diMapReadonly("protected");
      if(startRun < 0 || endRun < 0 || startRun !== endRun)
        return diMapReadonly("cross-run");
      return { status: "applicable", blockIdx: a.blockIdx, blockId: block.id, runIdx: startRun,
        startInRun: s.start - spans[startRun].start, endInRun: s.end - spans[startRun].start,
        expected: s.original };
    }
    function diMapAll(model, sync, suggestions){
      return (suggestions || []).map(function(s){ return diMapSuggestion(model, sync, s); });
    }
    /* ---------- D3: penerapan aman ke salinan kerja model ----------
       Model hasil impor TIDAK pernah diubah oleh bagian ini — penerapan
       selalu berjalan pada salinan kerja (diCloneModel). Saat menerapkan,
       posisi divalidasi ULANG terhadap model kerja yang berjalan:
       pertama pada offset yang tercatat; bila teks di sana sudah
       bergeser (penerapan lain lebih dulu), dicari kemunculan TUNGGAL
       teks asal di dalam run yang sama. Nol kemunculan = "stale",
       lebih dari satu = "ambiguous" — keduanya ditolak tanpa mengubah
       apa pun. Yang disambung HANYA teks run sasaran: jumlah & urutan
       run, flag format, dan struktur blok tidak pernah berubah, dan run
       terlindungi tidak pernah disentuh. */
    function diCloneModel(model){
      return JSON.parse(JSON.stringify(model));
    }
    function diApplyToModel(workingModel, mapped, replacement){
      if(!mapped || mapped.status !== "applicable")
        return { ok: false, reason: (mapped && mapped.reason) || "not-applicable" };
      var block = (workingModel.blocks || [])[mapped.blockIdx];
      if(!block) return { ok: false, reason: "stale" };
      var run = (block.runs || [])[mapped.runIdx];
      if(!run || run.protected) return { ok: false, reason: "stale" };
      var expected = mapped.expected;
      if(typeof expected !== "string" || !expected.length || typeof replacement !== "string")
        return { ok: false, reason: "stale" };
      var at = -1;
      if(mapped.startInRun >= 0 && run.text.slice(mapped.startInRun, mapped.startInRun + expected.length) === expected)
        at = mapped.startInRun;
      else {
        var first = run.text.indexOf(expected);
        if(first < 0) return { ok: false, reason: "stale" };
        if(run.text.indexOf(expected, first + 1) >= 0) return { ok: false, reason: "ambiguous" };
        at = first;
      }
      run.text = run.text.slice(0, at) + replacement + run.text.slice(at + expected.length);
      return { ok: true, blockIdx: mapped.blockIdx, runIdx: mapped.runIdx, startInRun: at, endInRun: at + expected.length };
    }
    /* ---------- D4: representasi HTML (salin kaya), peringatan ekspor, diff model ----------
       Tiga fungsi murni untuk mengeluarkan model dari halaman:
       - diModelToHtml: HTML untuk clipboard rich-text. HTML dibangun
         HANYA dari tag buatan sendiri + teks dokumen yang di-escape —
         tidak ada markup dari dokumen yang lolos apa adanya. Tautan
         hanya dirender sebagai <a> untuk skema http/https/mailto;
         skema lain (mis. javascript:) menjadi teks biasa.
       - diExportWarnings: daftar deterministik hal-hal yang TIDAK
         dipertahankan sempurna oleh salinan/ekspor, agar UI dapat
         menampilkannya SEBELUM unduhan — tidak ada kehilangan diam-diam.
       - diDiffModels: perbandingan per blok antara model asli dan model
         kerja (kata yang berubah ditandai del/ins). Murni membaca —
         tidak pernah mengubah kedua model. */
    function diLinkSafe(href){
      if(typeof href !== "string") return null;
      var h = href.replace(/^[\s\u0000-\u0020]+/, "").replace(/[\s\u0000-\u0020]+$/, "");
      if(!h) return null;
      if(/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
      return null;
    }
    function diHtmlText(s){
      /* Teks dokumen -> HTML: escape dulu, lalu \n menjadi <br>. */
      return diEscXmlText(String(s == null ? "" : s)).replace(/\n/g, "<br>");
    }
    var DI_FONT_NAME_OK = /^[A-Za-z0-9][A-Za-z0-9 ,.'\-()]*$/;
    function diRunHtml(run){
      if(run.protected)
        return "<span class=\"di-prot\">" + diHtmlText(run.text) + "</span>";
      var inner = diHtmlText(run.text);
      if(run.underline) inner = "<u>" + inner + "</u>";
      if(run.italic) inner = "<em>" + inner + "</em>";
      if(run.bold) inner = "<strong>" + inner + "</strong>";
      var style = "";
      if(run.fontName && DI_FONT_NAME_OK.test(run.fontName)) style += "font-family:'" + run.fontName + "';";
      if(typeof run.fontSize === "number" && run.fontSize > 0) style += "font-size:" + run.fontSize + "pt;";
      if(style) inner = "<span style=\"" + diEscXmlAttr(style) + "\">" + inner + "</span>";
      var safe = run.link ? diLinkSafe(run.link) : null;
      if(safe) inner = "<a href=\"" + diEscXmlAttr(safe) + "\">" + inner + "</a>";
      return inner;
    }
    function diBlockRunsHtml(block){
      var out = "";
      (block.runs || []).forEach(function(r){ out += diRunHtml(r); });
      return out;
    }
    function diAlignStyle(block){
      var a = block.align;
      if(a === "center") return " style=\"text-align:center\"";
      if(a === "right" || a === "end") return " style=\"text-align:right\"";
      if(a === "both" || a === "distribute") return " style=\"text-align:justify\"";
      return "";
    }
    function diTableHtml(model, tIdx, byId){
      var table = (model.tables || [])[tIdx];
      if(!table) return "";
      var out = "<table>";
      (table.rows || []).forEach(function(row, r){
        out += "<tr>";
        (row.cells || []).forEach(function(cell){
          if(cell.vMerge === "continue"){ out += "<td class=\"di-vmerge-cont\"></td>"; return; }
          var attrs = "";
          if(cell.gridSpan > 1) attrs += " colspan=\"" + cell.gridSpan + "\"";
          if(cell.vMerge === "restart"){
            var span = 1;
            for(var rr = r + 1; rr < table.rows.length; rr++){
              var cont = false;
              (table.rows[rr].cells || []).forEach(function(c2){ if(c2.c === cell.c && c2.vMerge === "continue") cont = true; });
              if(!cont) break;
              span++;
            }
            if(span > 1) attrs += " rowspan=\"" + span + "\"";
          }
          out += "<td" + attrs + ">";
          var cbs = (cell.blockIds || []).map(function(id){ return byId[id]; }).filter(Boolean)
            .sort(function(x, y){ return (x.cellPara || 0) - (y.cellPara || 0); });
          if(!cbs.length) out += "<p></p>";
          cbs.forEach(function(b){ out += "<p>" + diBlockRunsHtml(b) + "</p>"; });
          out += "</td>";
        });
        out += "</tr>";
      });
      return out + "</table>";
    }
    function diModelToHtml(model){
      var blocks = (model && model.blocks) || [];
      var byId = {};
      blocks.forEach(function(b){ byId[b.id] = b; });
      var out = "", listStack = []; /* { tag, kind, level, liOpen } */
      function closeList(){
        var top = listStack.pop();
        if(!top) return;
        if(top.liOpen) out += "</li>";
        out += "</" + top.tag + ">";
      }
      function closeListsTo(level, kind){
        while(listStack.length){
          var top = listStack[listStack.length - 1];
          if(top.level > level || (top.level === level && top.kind !== kind)) closeList();
          else break;
        }
      }
      function closeAllLists(){ while(listStack.length) closeList(); }
      var emittedTables = {};
      blocks.forEach(function(b){
        if(b.type === "table-cell"){
          if(!emittedTables[b.table]){
            emittedTables[b.table] = true;
            closeAllLists();
            out += diTableHtml(model, b.table, byId);
          }
          return;
        }
        if(b.type === "list-item"){
          var kind = b.listKind === "number" ? "number" : "bullet";
          var level = typeof b.level === "number" ? b.level : 0;
          closeListsTo(level, kind);
          var top = listStack[listStack.length - 1];
          if(!top || top.level < level){
            var tag = kind === "number" ? "ol" : "ul";
            out += "<" + tag + ">";
            listStack.push({ tag: tag, kind: kind, level: level, liOpen: false });
            top = listStack[listStack.length - 1];
          }
          if(top.liOpen) out += "</li>";
          out += "<li" + diAlignStyle(b) + ">" + diBlockRunsHtml(b);
          top.liOpen = true;
          return;
        }
        closeAllLists();
        if(b.type === "heading"){
          var lv = Math.min(6, Math.max(1, b.level || 1));
          out += "<h" + lv + diAlignStyle(b) + ">" + diBlockRunsHtml(b) + "</h" + lv + ">";
        } else {
          out += "<p" + diAlignStyle(b) + ">" + diBlockRunsHtml(b) + "</p>";
        }
      });
      closeAllLists();
      return out;
    }
    function diModelToPlainText(model){
      return diAssembleText(model).text;
    }
    /* D4.1 (F4): skema sebuah tautan, dinormalisasi seperti diLinkSafe
       (spasi/karakter kontrol di kedua ujung dipangkas dulu). Mengembalikan
       null bila tautan tidak memiliki skema (relatif atau jangkar) — tautan
       semacam itu TIDAK pernah dianggap tidak aman oleh peringatan. */
    var DI_SAFE_LINK_SCHEMES = { http: 1, https: 1, mailto: 1 };
    function diLinkScheme(link){
      if(typeof link !== "string") return null;
      var h = link.replace(/^[\s\u0000-\u0020]+/, "").replace(/[\s\u0000-\u0020]+$/, "");
      var m = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(h);
      return m ? m[1].toLowerCase() : null;
    }
    /* D4.1 (F5): apakah blok heading membawa identitas gaya KUSTOM yang
       namanya akan diganti gaya bawaan Heading pada berkas hasil.
       Bawaan dibuktikan oleh styleId Heading1..Heading6 ATAU nama
       ternormalisasi "heading N" / "judul N" (lokalisasi Word). Heading
       tanpa identitas gaya sama sekali tidak memicu: tidak ada nama
       gaya yang hilang. Gaya bawaan yang labelnya diganti pengguna
       (styleId tetap bawaan) diperlakukan sebagai bawaan — identitas
       gayanya memang bawaan; batas deteksi ini dinyatakan di laporan. */
    function diHeadingStyleCustom(b){
      if(!b || b.type !== "heading") return false;
      var id = b.styleId || null, nm = b.styleName || null;
      if(!id && !nm) return false;
      if(id && /^Heading[1-6]$/.test(id)) return false;
      if(nm && /^(heading|judul) [1-6]$/.test(String(nm).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").toLowerCase())) return false;
      return true;
    }
    /* D4.1 (F6): jumlah blok berindentasi bukan-nol. Dipakai HANYA oleh
       jalur salin — pada ekspor DOCX indentasi dipertahankan, jadi
       jenis peringatan ini sengaja TIDAK masuk diExportWarnings. */
    function diModelIndentCount(model){
      var n = 0;
      ((model && model.blocks) || []).forEach(function(b){
        var ind = b.indent;
        if(!ind) return;
        for(var k in ind){
          if(typeof ind[k] === "number" && ind[k] !== 0){ n++; return; }
        }
      });
      return n;
    }
    function diExportWarnings(model){
      var omml = 0, field = 0, object = 0, ulStyle = 0, linkUnsafe = 0, headingCustom = 0;
      ((model && model.blocks) || []).forEach(function(b){
        if(diHeadingStyleCustom(b)) headingCustom++;
        (b.runs || []).forEach(function(r){
          if(r.protected){
            if(r.kind === "omml") omml++;
            else if(r.kind === "field") field++;
            else if(r.kind === "object") object++;
          } else if(r.underline && r.underlineStyle) ulStyle++;
          if(r.link){
            var sc = diLinkScheme(r.link);
            if(sc && !DI_SAFE_LINK_SCHEMES[sc]) linkUnsafe++;
          }
        });
      });
      var nested = (model && model.flags && typeof model.flags.nestedTables === "number") ? model.flags.nestedTables : 0;
      var out = [];
      if(omml) out.push({ kind: "protected-omml", count: omml, message: "Rumus (OMML) tidak ditulis ulang sebagai rumus — pada salinan dan berkas hasil, rumus tampil sebagai teks linear biasa." });
      if(field) out.push({ kind: "protected-field", count: field, message: "Kolom isian (field) Word hanya dipertahankan sebagai teks hasil terakhirnya; field-nya sendiri tidak dipertahankan." });
      if(object) out.push({ kind: "protected-object", count: object, message: "Gambar/objek tertanam tidak disertakan pada salinan maupun berkas hasil." });
      if(ulStyle) out.push({ kind: "underline-style", count: ulStyle, message: "Gaya garis bawah selain garis tunggal (misalnya ganda atau bergelombang) menjadi garis tunggal." });
      if(nested) out.push({ kind: "nested-table", count: nested, message: "Ada tabel di dalam sel tabel — pada hasil, tabel tersebut ditempatkan sesudah tabel induknya, bukan di dalam sel." });
      if(linkUnsafe) out.push({ kind: "link-scheme", count: linkUnsafe, message: "Sebagian tautan memakai skema yang tidak didukung (di luar http/https/mailto) dan menjadi teks biasa pada hasil." });
      if(headingCustom) out.push({ kind: "heading-style", count: headingCustom, message: "Nama gaya heading kustom diganti gaya bawaan Heading pada berkas hasil; level heading dipertahankan." });
      if(model && model.format === "pdf") out.push({ kind: "pdf-source", count: (typeof model.pages === "number" ? model.pages : 1), message: "Dokumen ini berasal dari PDF: struktur halaman tidak dibuat ulang, dan format teksnya hanya perkiraan dari nama font — hasil ekspor adalah dokumen Word baru, bukan salinan persis PDF." });
      return out;
    }
    /* Diff kata per kata: token adalah run spasi / run bukan-spasi, sehingga
       perubahan spasi pun terlihat. Segmen dihitung dengan pemangkasan
       awalan+akhiran token yang sama (deterministik, O(n)); bagian tengah
       yang berbeda menjadi satu segmen del (asli) + satu segmen ins (kerja).
       Rekonstruksi: same+del+same = teks asli; same+ins+same = teks kerja. */
    function diDiffTokens(text){
      var parts = String(text == null ? "" : text).split(/(\s+)/), out = [];
      parts.forEach(function(t){ if(t) out.push(t); });
      return out;
    }
    function diDiffSegments(aText, bText){
      var a = diDiffTokens(aText), b = diDiffTokens(bText);
      var pre = 0;
      while(pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
      var suf = 0;
      while(suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
      var segs = [];
      function push(t, text){
        if(!text) return;
        var last = segs[segs.length - 1];
        if(last && last.t === t) last.text += text; else segs.push({ t: t, text: text });
      }
      push("same", a.slice(0, pre).join(""));
      push("del", a.slice(pre, a.length - suf).join(""));
      push("ins", b.slice(pre, b.length - suf).join(""));
      push("same", a.slice(a.length - suf).join(""));
      return segs;
    }
    /* Penyelarasan blok berdasarkan INDEKS: penerapan D3 tidak pernah
       menambah/menghapus blok, jadi untuk alur nyata pasangan indeks selalu
       tepat. Bila dua model berbeda panjang (kasus sintetis), kelebihan blok
       di model kerja berstatus "added" dan kelebihan di model asli "removed". */
    function diDiffModels(original, working){
      var ob = (original && original.blocks) || [], wb = (working && working.blocks) || [];
      var entries = [], changedCount = 0, n = Math.max(ob.length, wb.length);
      for(var i = 0; i < n; i++){
        if(i >= wb.length){
          entries.push({ status: "removed", origIdx: i, workIdx: -1, type: ob[i].type, origText: diBlockText(ob[i]) });
          changedCount++;
        } else if(i >= ob.length){
          entries.push({ status: "added", origIdx: -1, workIdx: i, type: wb[i].type, workText: diBlockText(wb[i]) });
          changedCount++;
        } else {
          var ot = diBlockText(ob[i]), wt = diBlockText(wb[i]);
          if(ot === wt) entries.push({ status: "unchanged", origIdx: i, workIdx: i, type: wb[i].type, workText: wt });
          else { entries.push({ status: "changed", origIdx: i, workIdx: i, type: wb[i].type, origText: ot, workText: wt, segments: diDiffSegments(ot, wt) }); changedCount++; }
        }
      }
      return { entries: entries, changedCount: changedCount };
    }
    /* DI-CORE-END */

    /* REPORT-CORE-START — Lapisan presentasi laporan (D5): fungsi MURNI
       pembangun model Laporan Analisis dari hasil wiAnalyze yang sudah
       ada. Blok ini berdiri di lapisan presentasi, BUKAN bagian inti
       dokumen dan BUKAN bagian inti penulisan: ia tidak mengubah model
       dokumen, pemetaan saran D3, penerapan aman, atau hasil analisis;
       ia hanya menyusun ulang data yang sudah dihitung menjadi data
       presentasi (hitungan, kelompok kategori, lokasi, rekomendasi
       turunan hitungan). Tanpa DOM, tanpa efek samping, deterministik:
       masukan tidak pernah diubah, urutan saran sumber tidak pernah
       diurutkan ulang, dan setiap saran muncul tepat satu kali pada
       keluarannya. */
    var DI_REPORT_CATEGORIES = [
      { name: "Ejaan", kinds: ["ejaan-mekanis", "kata-tidak-baku", "huruf-kapital", "sentence-capital"] },
      { name: "Tata bahasa", kinds: ["kata-depan", "imbuhan", "pemisahan-kata", "kata-ulang"] },
      { name: "Tanda baca & spasi", kinds: ["tanda-baca", "double-space", "missing-space-after-punctuation"] },
      { name: "Redundansi", kinds: ["repeated-word", "kalimat-mubazir"] },
      { name: "Kalimat", kinds: ["kalimat-kompleks", "kalimat-panjang", "kalimat-pengulangan-frasa", "transisi-awalan"] }
    ];
    var DI_REPORT_FALLBACK_CATEGORY = "Lainnya";
    var DI_REPORT_CERTAINTIES = ["pasti", "saran", "potensial", "gaya"];
    function diReportCategoryForKind(kind){
      for(var i = 0; i < DI_REPORT_CATEGORIES.length; i++)
        if(DI_REPORT_CATEGORIES[i].kinds.indexOf(kind) >= 0) return DI_REPORT_CATEGORIES[i].name;
      return DI_REPORT_FALLBACK_CATEGORY;
    }
    /* diBuildReport(analysis, extras) — pembangun model laporan.
       analysis: keluaran wiAnalyze apa adanya { paragraphs, separators,
       suggestions, truncated }.
       extras (semua opsional; data polos yang diserahkan lapisan UI):
         acceptedIds: [id...], rejectedIds: [id...],
         readability: { score, band, words, sentences, paragraphs,
           avgWordsPerSentence, longShare, denseParas } | null,
         doc: { name, stats, assembly: { truncated, keptBlocks,
           totalBlocks }, mapping: { id: hasil pemetaan D3 },
           appliedIds: [id...], refused: { id: teks alasan } } | null.
       Keadaan keputusan meniru persis penghitungan wiRender: saran yang
       ditolak terhitung "rejected" (atau "read" bila penasihat); saran
       non-penasihat yang diterima terhitung "accepted"; sisanya
       "pending". Rekomendasi HANYA diturunkan dari hitungan yang ada. */
    function diBuildReport(analysis, extras){
      extras = extras || {};
      var suggestions = (analysis && analysis.suggestions) || [];
      var paras = (analysis && analysis.paragraphs) || [];
      var seps = (analysis && analysis.separators) || [];
      var accepted = {};
      (extras.acceptedIds || []).forEach(function(id){ accepted[id] = 1; });
      var rejected = {};
      (extras.rejectedIds || []).forEach(function(id){ rejected[id] = 1; });
      var doc = extras.doc || null;
      var mapping = doc && doc.mapping ? doc.mapping : null;
      var applied = {};
      if(doc && doc.appliedIds) doc.appliedIds.forEach(function(id){ applied[id] = 1; });
      /* Offset global tiap paragraf di dalam teks gabungan: penggabungan
         paragraf+pemisah mereproduksi persis string yang dianalisis,
         jadi rentang global saran = awal paragraf + (start..end) saran. */
      var paraStart = [], acc = 0;
      paras.forEach(function(p, i){
        paraStart.push(acc);
        acc += p.length + (i < seps.length ? String(seps[i] == null ? "" : seps[i]).length : 0);
      });
      var byCertainty = { "pasti": 0, "saran": 0, "potensial": 0, "gaya": 0 };
      var pendingCertainty = { "pasti": 0, "saran": 0, "potensial": 0, "gaya": 0 };
      var decisions = { accepted: 0, pending: 0, rejected: 0, read: 0 };
      var groups = {};
      var readonlyReasons = {}, readonlyTotal = 0, advisoryCount = 0;
      suggestions.forEach(function(s){
        if(Object.prototype.hasOwnProperty.call(byCertainty, s.certainty)) byCertainty[s.certainty]++;
        var state;
        if(rejected[s.id]) state = s.advisory ? "read" : "rejected";
        else if(!s.advisory && accepted[s.id]) state = "accepted";
        else state = "pending";
        decisions[state]++;
        if(state === "pending" && Object.prototype.hasOwnProperty.call(pendingCertainty, s.certainty)) pendingCertainty[s.certainty]++;
        if(s.advisory) advisoryCount++;
        var item = {
          id: s.id, kind: s.kind, certainty: s.certainty,
          paragraph: (typeof s.pIdx === "number" ? s.pIdx : 0) + 1,
          original: s.original,
          advisory: !!s.advisory,
          canApply: !s.advisory && typeof s.replacement === "string",
          state: state,
          globalStart: (typeof s.pIdx === "number" && paraStart[s.pIdx] != null ? paraStart[s.pIdx] : 0) + (s.start || 0),
          globalEnd: (typeof s.pIdx === "number" && paraStart[s.pIdx] != null ? paraStart[s.pIdx] : 0) + (s.end || 0),
          doc: null
        };
        if(doc){
          var m = mapping ? mapping[s.id] : null;
          item.doc = {
            status: m ? (m.status || null) : null,
            reason: m ? (m.reason || null) : null,
            reasonText: m ? (m.reasonText || null) : null,
            blockIdx: m && typeof m.blockIdx === "number" ? m.blockIdx : null,
            applied: !!applied[s.id],
            refused: doc.refused && doc.refused[s.id] ? doc.refused[s.id] : null
          };
          if(m && m.status === "readonly"){
            var rt = m.reasonText || m.reason || "readonly";
            readonlyReasons[rt] = (readonlyReasons[rt] || 0) + 1;
            readonlyTotal++;
          }
        }
        var catName = diReportCategoryForKind(s.kind);
        if(!groups[catName]) groups[catName] = { byCertainty: { "pasti": 0, "saran": 0, "potensial": 0, "gaya": 0 }, items: [] };
        groups[catName].items.push(item);
        if(Object.prototype.hasOwnProperty.call(groups[catName].byCertainty, s.certainty)) groups[catName].byCertainty[s.certainty]++;
      });
      var categories = [];
      function pushCategory(name){
        if(!groups[name]) return;
        categories.push({ name: name, count: groups[name].items.length, byCertainty: groups[name].byCertainty, items: groups[name].items });
      }
      DI_REPORT_CATEGORIES.forEach(function(c){ pushCategory(c.name); });
      pushCategory(DI_REPORT_FALLBACK_CATEGORY);
      /* Rekomendasi: hanya kalimat yang dapat ditelusur ke hitungan di atas. */
      var recommendations = [];
      if(suggestions.length === 0){
        recommendations.push("Tidak ada temuan pada teks ini. Pemeriksa bekerja dengan aturan dan daftar kata tertutup, jadi teks tetap perlu dibaca kembali secara manual.");
      }
      if(pendingCertainty.pasti > 0)
        recommendations.push("Mulai dari " + pendingCertainty.pasti + " temuan Aturan pasti yang masih menunggu keputusan — temuan ini mengikuti aturan tulis baku dan perbaikannya bersifat mekanis.");
      if(doc && readonlyTotal > 0){
        var topReason = null, topCount = 0;
        Object.keys(readonlyReasons).forEach(function(k){ if(readonlyReasons[k] > topCount){ topCount = readonlyReasons[k]; topReason = k; } });
        recommendations.push("Sebanyak " + readonlyTotal + " saran tidak dapat diterapkan otomatis ke dokumen kerja (alasan terbanyak: " + topReason + ") — terapkan perbaikannya secara manual pada dokumen bila Anda setuju.");
      }
      if(doc && doc.assembly && doc.assembly.truncated)
        recommendations.push("Dokumen terpotong pada batas blok (" + doc.assembly.keptBlocks + " dari " + doc.assembly.totalBlocks + " blok yang dianalisis) — periksa blok selebihnya secara terpisah agar seluruh dokumen tertinjau.");
      if(advisoryCount > 0)
        recommendations.push(advisoryCount + " saran bersifat penasihat (kalimat panjang, kalimat kompleks, pengulangan frasa, transisi antarkalimat) — saran ini tidak mengubah teks dan hanya untuk Anda pertimbangkan.");
      var limitations = [
        "Pemeriksa ini bekerja dengan aturan dan daftar kata tertutup — tidak semua kesalahan tertangkap, dan teks tetap perlu dibaca kembali secara manual.",
        "Skor keterbacaan adalah indikator statistik internal Saksara — bukan penilaian ilmiah tervalidasi, bukan penilaian akademik, dan bukan ukuran mutlak kualitas tulisan."
      ];
      if(doc && doc.stats && doc.stats.protected > 0)
        limitations.push("Sebanyak " + doc.stats.protected + " elemen terlindungi pada dokumen (rumus, kolom isian, gambar) tidak ikut dianalisis dan tidak pernah diubah.");
      if(doc)
        limitations.push("Lokasi temuan menunjuk teks hasil impor di kotak masukan, bukan berkas asli Anda.");
      return {
        total: suggestions.length,
        byCertainty: DI_REPORT_CERTAINTIES.map(function(k){ return { key: k, count: byCertainty[k] }; }),
        decisions: decisions,
        categories: categories,
        readability: extras.readability || null,
        coverage: {
          mode: doc ? "doc" : "text",
          paragraphs: paras.length,
          analyzedChars: acc,
          analysisTruncated: !!(analysis && analysis.truncated),
          docName: doc ? (doc.name || null) : null,
          docStats: doc ? (doc.stats || null) : null,
          docTruncated: doc && doc.assembly ? !!doc.assembly.truncated : false,
          keptBlocks: doc && doc.assembly ? doc.assembly.keptBlocks : null,
          totalBlocks: doc && doc.assembly ? doc.assembly.totalBlocks : null,
          appliedToDoc: doc ? (doc.appliedIds || []).length : 0,
          readonlyCount: readonlyTotal
        },
        recommendations: recommendations,
        limitations: limitations
      };
    }
    /* ---------- D6: jahitan murni ekspor PDF Laporan Analisis ----------
       Fungsi-fungsi murni (tanpa DOM, deterministik, tidak mengubah
       masukan) yang mengubah MODEL laporan D5 menjadi susunan blok teks
       PDF, plus pra-cek karakter. PDF adalah representasi model yang
       sama dengan panel — tidak ada hitungan ulang di sini: angka
       diformat (pengelompokan ribuan titik, meniru fmtNumID lapisan UI
       agar angka PDF == angka panel), label diserahkan lapisan UI
       lewat extras (kindLabels/certLabels/stateLabels — peta label
       yang sama dengan yang dipakai panel), penjelasan + saran
       perbaikan digabungkan dari saran sumber lewat id (details),
       dan teks status dokumen dihitung lapisan UI dengan fungsi yang
       sama dengan panel (docStatus). Kutipan selalu item.original
       MENTAH — tidak pernah hasil gambar wiShowWs. */
    function diReportFmtNum(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
    function diReportPdfFileName(date){
      function p2(x){ return (x < 10 ? "0" : "") + x; }
      return "saksara-laporan-analisis-" + date.getFullYear() + "-" + p2(date.getMonth() + 1) + "-" + p2(date.getDate()) + ".pdf";
    }
    function diReportPdfLines(model, extras){
      extras = extras || {};
      var kindLabels = extras.kindLabels || {}, certLabels = extras.certLabels || {}, stateLabels = extras.stateLabels || {};
      var details = extras.details || {}, docStatus = extras.docStatus || {};
      var cov = model.coverage || {};
      var blocks = [];
      blocks.push({ t: "title", text: "LAPORAN ANALISIS TULISAN" });
      blocks.push({ t: "meta", text: "Asisten Menulis Cerdas · Saksara" });
      blocks.push({ t: "meta", text: "Dibuat lokal di peramban · " + (extras.dateStr || "") + " · saksara.vercel.app" });
      /* Ringkasan analisis — angka yang sama dengan bagian A panel. */
      blocks.push({ t: "h", text: "Ringkasan Analisis" });
      var rows = [];
      rows.push(["Total temuan", diReportFmtNum(model.total)]);
      (model.byCertainty || []).forEach(function(c){ rows.push([certLabels[c.key] || c.key, diReportFmtNum(c.count)]); });
      var dec = model.decisions || { accepted: 0, pending: 0, rejected: 0, read: 0 };
      var decParts = [diReportFmtNum(dec.accepted) + " diterima", diReportFmtNum(dec.pending) + " menunggu keputusan"];
      if(dec.rejected) decParts.push(diReportFmtNum(dec.rejected) + " ditolak");
      if(dec.read) decParts.push(diReportFmtNum(dec.read) + " ditandai sudah dibaca");
      rows.push(["Keputusan Anda", decParts.join(", ")]);
      rows.push(["Paragraf dianalisis", diReportFmtNum(cov.paragraphs || 0)]);
      rows.push(["Karakter dianalisis", diReportFmtNum(cov.analyzedChars || 0)]);
      if(cov.mode === "doc"){
        rows.push(["Dokumen", cov.docName || ""]);
        if(cov.docStats){
          var st = cov.docStats;
          rows.push(["Blok dokumen", diReportFmtNum(st.blocks)]);
          rows.push(["Kata pada dokumen", diReportFmtNum(st.words)]);
          if(st.headings) rows.push(["Judul pada dokumen", diReportFmtNum(st.headings)]);
          if(st.tables) rows.push(["Tabel pada dokumen", diReportFmtNum(st.tables)]);
          if(typeof st.pages === "number" && st.pages > 0) rows.push(["Halaman dokumen", diReportFmtNum(st.pages)]);
        }
        rows.push(["Diterapkan ke dokumen kerja", diReportFmtNum(cov.appliedToDoc || 0)]);
      }
      blocks.push({ t: "kv", rows: rows });
      if(cov.docTruncated) blocks.push({ t: "p", text: "Cakupan: dokumen dipotong pada batas blok — " + diReportFmtNum(cov.keptBlocks) + " dari " + diReportFmtNum(cov.totalBlocks) + " blok teks pertama yang dianalisis; blok selebihnya belum dianalisis." });
      if(cov.analysisTruncated) blocks.push({ t: "p", text: "Cakupan: analisis internal terpotong pada batas 50.000 karakter." });
      if(cov.mode === "doc" && cov.docStats && cov.docStats.protected > 0)
        blocks.push({ t: "p", text: "Sebanyak " + diReportFmtNum(cov.docStats.protected) + " elemen terlindungi (rumus, kolom isian, gambar) tidak ikut dianalisis." });
      /* Ringkasan kualitas — skor keterbacaan D5 apa adanya + catatan wajib. */
      if(model.readability){
        var rd = model.readability;
        blocks.push({ t: "h", text: "Ringkasan Kualitas — Keterbacaan" });
        blocks.push({ t: "kv", rows: [
          ["Skor keterbacaan", String(rd.score) + " — " + rd.band],
          ["Rata-rata kata per kalimat", String(rd.avgWordsPerSentence).replace(".", ",")],
          ["Kalimat > 40 kata", String(rd.longShare).replace(".", ",") + "%"],
          ["Paragraf padat", diReportFmtNum(rd.denseParas)],
          ["Kalimat", diReportFmtNum(rd.sentences)],
          ["Kata", diReportFmtNum(rd.words)]
        ] });
        blocks.push({ t: "p", text: "Skor ini adalah indikator statistik internal/heuristik — bukan penilaian akademik, bukan penilaian ilmiah tervalidasi, dan bukan ukuran mutlak kualitas tulisan." });
      }
      /* Detail temuan — setiap item model tepat satu kali, urutan model. */
      blocks.push({ t: "h", text: "Detail Temuan" });
      if(!model.total) blocks.push({ t: "p", text: "Tidak ada temuan pada teks ini." });
      (model.categories || []).forEach(function(cat){
        blocks.push({ t: "h2", text: cat.name + " — " + diReportFmtNum(cat.count) + " temuan" });
        cat.items.forEach(function(item){
          var fields = [];
          fields.push(["Kutipan", String(item.original == null ? "" : item.original)]);
          var det = details[item.id] || {};
          if(det.explanation) fields.push(["Penjelasan", String(det.explanation)]);
          if(!item.advisory && typeof det.replacement === "string") fields.push(["Saran perbaikan", det.replacement]);
          fields.push(["Keputusan", stateLabels[item.state] || item.state]);
          if(docStatus[item.id]) fields.push(["Dokumen", String(docStatus[item.id])]);
          if(item.advisory) fields.push(["Catatan", "Saran penasihat — tidak mengubah teks"]);
          blocks.push({ t: "finding", id: item.id,
            head: (kindLabels[item.kind] || item.kind) + " · " + (certLabels[item.certainty] || item.certainty) + " · Paragraf ke-" + diReportFmtNum(item.paragraph),
            fields: fields });
        });
      });
      /* Rekomendasi + keterbatasan — string model apa adanya. */
      blocks.push({ t: "h", text: "Rekomendasi" });
      (model.recommendations || []).forEach(function(r){ blocks.push({ t: "li", text: String(r) }); });
      blocks.push({ t: "h", text: "Keterbatasan Analisis" });
      (model.limitations || []).forEach(function(r){ blocks.push({ t: "li", text: String(r) }); });
      blocks.push({ t: "p", text: "Laporan ini adalah bantuan analisis tulisan — bukan keputusan akademik yang mutlak." });
      return blocks;
    }
    /* Seluruh string yang akan dicetak PDF, diratakan dari blok —
       dasar pra-cek karakter (tidak ada teks yang lolos dari pra-cek). */
    function diReportPdfTexts(blocks){
      var out = [];
      (blocks || []).forEach(function(b){
        if(b.t === "kv"){ b.rows.forEach(function(r){ out.push(String(r[0])); out.push(String(r[1])); }); }
        else if(b.t === "finding"){ out.push(b.head); b.fields.forEach(function(f){ out.push(String(f[0])); out.push(String(f[1])); }); }
        else if(b.text != null) out.push(String(b.text));
      });
      return out;
    }
    /* Pra-cek font ter-embed: coverage adalah daftar rentang codepoint
       [lo, hi] terurut yang DIEKSTRAK dari cmap berkas font subset yang
       benar-benar terbangun (fonts/noto-sans-coverage.json), bukan dari
       niat charset. Karakter whitespace tata-letak (\n \r \t) dilewati —
       ia dirender sebagai spasi/pindah baris, bukan glif isi. */
    function diPdfCpInRanges(ranges, cp){
      var lo = 0, hi = (ranges || []).length - 1;
      while(lo <= hi){
        var mid = (lo + hi) >> 1;
        if(cp < ranges[mid][0]) hi = mid - 1;
        else if(cp > ranges[mid][1]) lo = mid + 1;
        else return true;
      }
      return false;
    }
    function diPdfEachChar(texts, fn){
      (texts || []).forEach(function(t){
        var s = String(t == null ? "" : t);
        for(var i = 0; i < s.length; i++){
          var cp = s.codePointAt(i);
          var ch = String.fromCodePoint(cp);
          if(cp > 0xFFFF) i++;
          if(cp === 0x0A || cp === 0x0D || cp === 0x09) continue;
          fn(ch, cp);
        }
      });
    }
    function diPdfPreflight(texts, coverage){
      var seen = {}, unsupported = [];
      diPdfEachChar(texts, function(ch, cp){
        if(diPdfCpInRanges(coverage, cp)) return;
        var key = "U+" + cp.toString(16).toUpperCase();
        if(seen[key]) return;
        seen[key] = 1;
        unsupported.push({ ch: ch, cp: "U+" + (cp < 0x10000 ? ("000" + cp.toString(16).toUpperCase()).slice(-4) : cp.toString(16).toUpperCase()) });
      });
      return { ok: unsupported.length === 0, unsupported: unsupported };
    }
    /* Helvetica (font inti jsPDF): karakter "aman ketat" bila pdfSafe
       membiarkannya persis sama — himpunan eksplisit yang setara dengan
       perilaku pdfSafe: \x20–\x7E dan \xA0–\xFF KECUALI yang dipetakan
       pdfSafe (« » ± ×). Karakter "terhapus" adalah yang dibuang
       pdfSafe diam-diam (di luar kedua rentang dan tidak dipetakan):
       inilah yang menghentikan ekspor fallback, karena penghapusan
       menempelkan kata dan mengubah makna (A→B menjadi AB, €50 menjadi
       50). Karakter yang DIPETAKAN pdfSafe (— menjadi -, "…" menjadi
       ...) tidak hilang dan tidak menempelkan kata; pada jalur fallback
       ia dirender lewat pdfSafe dengan pemberitahuan font cadangan
       yang eksplisit — perilaku yang sama dengan keempat laporan PDF
       Saksara yang sudah ada. */
    var DI_PDF_HELVETICA_MAPPED = { 0x201C: 1, 0x201D: 1, 0x201E: 1, 0x00AB: 1, 0x00BB: 1, 0x2018: 1, 0x2019: 1, 0x201A: 1, 0x2014: 1, 0x2013: 1, 0x2026: 1, 0x00B1: 1, 0x00D7: 1, 0x2265: 1, 0x2264: 1, 0x2022: 1 };
    function diPdfHelveticaSafeChar(cp){
      if(cp >= 0x20 && cp <= 0x7E) return true;
      if(cp >= 0xA0 && cp <= 0xFF) return !(cp === 0xAB || cp === 0xBB || cp === 0xB1 || cp === 0xD7);
      return false;
    }
    function diPdfHelveticaSafe(text){
      var ok = true;
      diPdfEachChar([text], function(ch, cp){ if(!diPdfHelveticaSafeChar(cp)) ok = false; });
      return ok;
    }
    function diPdfHelveticaDeleted(texts){
      var seen = {}, out = [];
      diPdfEachChar(texts, function(ch, cp){
        var inRange = (cp >= 0x20 && cp <= 0x7E) || (cp >= 0xA0 && cp <= 0xFF);
        if(inRange || DI_PDF_HELVETICA_MAPPED[cp]) return;
        var key = "U+" + cp.toString(16).toUpperCase();
        if(seen[key]) return;
        seen[key] = 1;
        out.push({ ch: ch, cp: "U+" + (cp < 0x10000 ? ("000" + cp.toString(16).toUpperCase()).slice(-4) : cp.toString(16).toUpperCase()) });
      });
      return out;
    }
    /* REPORT-CORE-END */

    /* ANNOT-CORE-START — Lapisan presentasi laporan beranotasi (D8,
       Tahap 1): fungsi MURNI pembangun model Laporan Beranotasi dari
       hasil wiAnalyze yang sudah ada. Blok saudara REPORT-CORE: ia
       TIDAK mengubah WI-CORE, DI-CORE, REPORT-CORE, model dokumen,
       atau hasil analisis; ia hanya menurunkan data presentasi baru —
       dokumen yang akan dirender beserta penanda temuannya, dan
       daftar temuan bernomor dengan kalimat lengkap serta usulan
       kalimat lengkap. Tanpa DOM, tanpa PDF, tanpa efek samping,
       deterministik: masukan tidak pernah diubah, dan penomoran
       temuan adalah urutan dokumen dari daftar saran sumber apa
       adanya (wiAnalyze sudah mengurutkan per paragraf + offset).
       Ketergantungan (fungsi murni yang sudah ada dan tidak diubah,
       dalam scope <script> yang sama): wiSentences (WI-CORE) untuk
       segmentasi kalimat penampung; diReportCategoryForKind,
       diPdfEachChar, diPdfCpInRanges (REPORT-CORE) untuk kategori
       dan inventaris karakter font; diBlockText, diSyncModel,
       diMapAll (DI-CORE) untuk teks blok dan pemetaan dokumen.
       Komposisi usulan = substitusi mekanis SATU temuan ke kalimat
       penampungnya — operasi yang sama dengan wiApply, dibatasi
       satu temuan, tanpa logika bahasa baru (kapitalisasi kata
       pengganti sudah dicocokkan aturan sendiri lewat wiMatchCase).
       Temuan penasihat tidak pernah diberi kalimat karangan:
       proposedSentence = null dan manualReview = true. */
    var ANNOT_MANUAL_REVIEW_LABEL = "Perlu ditinjau manual";
    var ANNOT_UNANCHORED_NOTE = "Tidak dapat ditandai pada dokumen — teks berubah sesudah analisis.";
    /* annotBuildReport(analysis, extras) — pembangun model beranotasi.
       analysis: keluaran wiAnalyze apa adanya { paragraphs, separators,
       suggestions, truncated }.
       extras (semua opsional; data polos yang diserahkan lapisan UI):
         acceptedIds: [id...], rejectedIds: [id...] — keadaan keputusan,
           dihitung persis seperti diBuildReport (D-3: SEMUA temuan
           ditampilkan, keadaan tercetak pada model);
         kindLabels / certLabels: peta label presentasi yang sama
           dengan yang diterima jahitan D6 (fallback: kunci mentah);
         coverage: rentang codepoint font subset [[lo, hi], ...] —
           bentuk yang sama dengan yang dikonsumsi diPdfPreflight —
           untuk inventaris karakter di luar subset per blok (D-1);
           tanpa coverage, inventaris bernilai null (tidak diketahui);
         doc: { name, model, sync?, mapping?, assembly? } | null —
           model adalah DocModel impor; sync (hasil diSyncModel) dan
           mapping ({ id: hasil diMapAll }, bentuk yang dibangun
           lapisan UI) dipakai apa adanya bila diserahkan, dan
           diturunkan dengan fungsi DI-CORE yang sama bila tidak. */
    function annotBuildReport(analysis, extras){
      extras = extras || {};
      var paras = (analysis && analysis.paragraphs) || [];
      var seps = (analysis && analysis.separators) || [];
      var suggestions = (analysis && analysis.suggestions) || [];
      var kindLabels = extras.kindLabels || {};
      var certLabels = extras.certLabels || {};
      var coverage = Array.isArray(extras.coverage) ? extras.coverage : null;
      var accepted = {};
      (extras.acceptedIds || []).forEach(function(id){ accepted[id] = 1; });
      var rejected = {};
      (extras.rejectedIds || []).forEach(function(id){ rejected[id] = 1; });
      var doc = extras.doc || null;
      var model = doc && doc.model ? doc.model : null;
      var mode = !model ? "paste" : (model.format === "pdf" ? "pdf" : "docx");
      var sync = null, mapping = null;
      if(model){
        sync = doc.sync || diSyncModel(model, paras);
        if(Array.isArray(doc.mapping)){
          mapping = {};
          doc.mapping.forEach(function(m, i){ if(suggestions[i]) mapping[suggestions[i].id] = m; });
        } else if(doc.mapping){
          mapping = doc.mapping;
        }
        if(!mapping){
          var mappedArr = diMapAll(model, sync, suggestions);
          mapping = {};
          suggestions.forEach(function(s, i){ mapping[s.id] = mappedArr[i]; });
        }
      }
      function mapFor(s){ return mapping ? (mapping[s.id] || null) : null; }
      /* Inventaris D-1: karakter di luar subset font pada satu teks,
         dalam urutan kemunculan pertama, dengan hitungan. Memakai
         penjelajah codepoint REPORT-CORE yang sama dengan pra-cek D6
         (aman karakter astral; \n \r \t dilewati sebagai whitespace
         tata letak). null bila coverage tidak diserahkan. */
      function annotInventory(text){
        if(!coverage) return null;
        var seen = {}, out = [];
        diPdfEachChar([text], function(ch, cp){
          if(diPdfCpInRanges(coverage, cp)) return;
          var key = "U+" + cp.toString(16).toUpperCase();
          if(seen[key]){ seen[key].count++; return; }
          var e = { ch: ch, cp: "U+" + (cp < 0x10000 ? ("000" + cp.toString(16).toUpperCase()).slice(-4) : cp.toString(16).toUpperCase()), count: 1 };
          seen[key] = e; out.push(e);
        });
        return out;
      }
      /* Kalimat penampung: span wiSentences yang memuat rentang saran.
         wiSentences dipanggil tanpa argumen quotes — nilai bawaannya
         (wiQuoteSpans) adalah sumber yang sama dengan yang dipakai
         aturan saat analisis, jadi span identik. */
      var sentCache = {};
      function annotSentenceFor(s){
        var p = paras[s.pIdx] || "";
        var spans = sentCache[s.pIdx];
        if(!spans){ spans = wiSentences(p); sentCache[s.pIdx] = spans; }
        for(var i = 0; i < spans.length; i++){
          if(spans[i].start <= s.start && s.end <= spans[i].end)
            return { text: p.slice(spans[i].start, spans[i].end), start: s.start - spans[i].start, end: s.end - spans[i].start, key: s.pIdx + ":" + spans[i].start };
        }
        /* Cadangan jujur: rentang tidak termuat satu span kalimat
           (wilayah yang dipangkas segmentasi) — penampung dinyatakan
           sebagai seluruh paragraf, offset apa adanya. */
        return { text: p, start: s.start, end: s.end, key: s.pIdx + ":para" };
      }
      var analyzedChars = 0;
      paras.forEach(function(p, i){
        analyzedChars += p.length + (i < seps.length ? String(seps[i] == null ? "" : seps[i]).length : 0);
      });
      /* ---------- Sisi dokumen: blok terender + penanda ---------- */
      var renderBlocks = [], blockPosByIdx = {};
      if(!model){
        paras.forEach(function(p, idx){
          renderBlocks.push({ key: "p" + (idx + 1), type: "paragraph", text: p, analyzed: true,
            segments: p.length ? [{ start: 0, end: p.length }] : [], marks: [], unsupported: annotInventory(p) });
          blockPosByIdx["p:" + idx] = renderBlocks.length - 1;
        });
      } else {
        var matchedBlocks = {};
        (sync.align || []).forEach(function(a){ if(a && a.status === "matched") matchedBlocks[a.blockIdx] = true; });
        (model.blocks || []).forEach(function(b, bi){
          var text = diBlockText(b);
          var segments = [], pos = 0;
          (b.runs || []).forEach(function(r){
            if(r.protected){ segments.push({ start: pos, end: pos, protected: true, kind: r.kind || null }); return; }
            var seg = { start: pos, end: pos + (r.text ? r.text.length : 0) };
            if(r.bold) seg.bold = true;
            if(r.italic) seg.italic = true;
            if(r.underline) seg.underline = true;
            segments.push(seg); pos = seg.end;
          });
          var rb = { key: b.id, type: b.type, text: text, analyzed: !!matchedBlocks[bi],
            segments: segments, marks: [], unsupported: annotInventory(text) };
          if(typeof b.level === "number") rb.level = b.level;
          if(b.listKind) rb.listKind = b.listKind;
          if(typeof b.page === "number") rb.page = b.page;
          if(b.type === "table-cell")
            rb.tableRef = { table: (typeof b.table === "number" ? b.table : null), r: (typeof b.r === "number" ? b.r : null), c: (typeof b.c === "number" ? b.c : null), cellPara: (typeof b.cellPara === "number" ? b.cellPara : null) };
          renderBlocks.push(rb);
          blockPosByIdx["b:" + bi] = renderBlocks.length - 1;
        });
      }
      /* ---------- Sisi temuan: bernomor urutan dokumen ---------- */
      var derived = suggestions.map(function(s){ return annotSentenceFor(s); });
      var sentCounts = {};
      derived.forEach(function(d){ sentCounts[d.key] = (sentCounts[d.key] || 0) + 1; });
      var findings = [];
      suggestions.forEach(function(s, i){
        var no = i + 1;
        var advisory = !!s.advisory;
        var hasProposal = !advisory && typeof s.replacement === "string";
        var sent = derived[i];
        var state;
        if(rejected[s.id]) state = advisory ? "read" : "rejected";
        else if(!advisory && accepted[s.id]) state = "accepted";
        else state = "pending";
        var m = model ? mapFor(s) : null;
        var anchor, rbPos = -1;
        if(!model){
          anchor = { type: "paragraph", paragraphIdx: s.pIdx };
          rbPos = blockPosByIdx["p:" + s.pIdx];
        } else {
          var a = sync.align ? sync.align[s.pIdx] : null;
          if(!a || a.status !== "matched"){
            anchor = { type: "none", note: (m && (m.reasonText || (m.reason ? (DI_MAP_REASON_TEXT[m.reason] || m.reason) : null))) || ANNOT_UNANCHORED_NOTE };
          } else if(m && m.reason === "text-mismatch"){
            anchor = { type: "none", note: m.reasonText || ANNOT_UNANCHORED_NOTE };
          } else {
            var block = (model.blocks || [])[a.blockIdx];
            anchor = { type: "block", blockIdx: a.blockIdx, blockId: block ? block.id : null };
            if(block && typeof block.page === "number") anchor.page = block.page;
            rbPos = blockPosByIdx["b:" + a.blockIdx];
          }
        }
        if(typeof rbPos === "number" && rbPos >= 0 && renderBlocks[rbPos])
          renderBlocks[rbPos].marks.push({ no: no, start: s.start, end: s.end, advisory: advisory });
        findings.push({
          no: no, id: s.id, kind: s.kind,
          kindLabel: kindLabels[s.kind] || s.kind,
          category: diReportCategoryForKind(s.kind),
          certainty: s.certainty, certaintyLabel: certLabels[s.certainty] || s.certainty,
          state: state, advisory: advisory, manualReview: !hasProposal,
          paragraphNo: (typeof s.pIdx === "number" ? s.pIdx : 0) + 1,
          original: s.original,
          sentenceText: sent.text,
          rangeInSentence: { start: sent.start, end: sent.end },
          proposedSentence: hasProposal ? sent.text.slice(0, sent.start) + s.replacement + sent.text.slice(sent.end) : null,
          explanation: s.explanation,
          sharedSentence: (sentCounts[sent.key] || 0) > 1,
          anchor: anchor,
          mapStatus: m ? (m.status || null) : null,
          mapReasonText: m ? (m.reasonText || null) : null
        });
      });
      var totals = { findings: findings.length, withProposal: 0, manualReview: 0, advisory: 0, anchored: 0, unanchored: 0 };
      findings.forEach(function(f){
        if(f.proposedSentence != null) totals.withProposal++;
        if(f.manualReview) totals.manualReview++;
        if(f.advisory) totals.advisory++;
        if(f.anchor.type === "none") totals.unanchored++; else totals.anchored++;
      });
      var unsupported = null;
      if(coverage){
        unsupported = [];
        var useen = {};
        renderBlocks.forEach(function(rb){
          (rb.unsupported || []).forEach(function(e){
            if(useen[e.cp]){ useen[e.cp].count += e.count; return; }
            var c = { ch: e.ch, cp: e.cp, count: e.count };
            useen[e.cp] = c; unsupported.push(c);
          });
        });
      }
      return {
        source: { mode: mode, fileName: doc ? (doc.name || null) : null,
          analyzedChars: analyzedChars,
          analysisTruncated: !!(analysis && analysis.truncated),
          docTruncated: doc && doc.assembly ? !!doc.assembly.truncated : false },
        renderBlocks: renderBlocks,
        findings: findings,
        totals: totals,
        unsupported: unsupported
      };
    }
    /* ANNOT-CORE-END */

    /* ANNOT-PDF-CORE-START — Lapisan presentasi Laporan Anotasi (D8,
       Tahap 2): mesin tata letak MURNI satu-lintasan untuk PDF
       beranotasi. Fungsi di blok ini TIDAK menggambar apa pun: ia
       mengubah model beranotasi (annotBuildReport, ANNOT-CORE) menjadi
       RENCANA gambar — daftar halaman berisi operasi teks/rect/garis/
       nomor pada koordinat milimeter yang SUDAH FINAL.
       Syarat C-2 audit dipenuhi menurut konstruksi: teks dipecah
       menjadi fragmen pada gabungan batas gaya (run) dan batas
       penanda; setiap fragmen diukur SATU KALI lewat opts.measure,
       dan rect sorotan, garis penasihat, serta operasi teks fragmen
       itu semuanya dibaca dari geometri fragmen yang sama di dalam
       rencana. Pelaksana (lem UI) tidak pernah mengukur ulang — tidak
       ada pengukuran kedua yang bisa membuat penanda bergeser dari
       glifnya. Rentang yang melintasi baris/halaman terbelah per
       fragmen baris secara alami; nomor temuan hanya ditempel pada
       fragmen pertama penanda itu.
       Kebijakan karakter D-1: bila opts.coverage (rentang codepoint
       subset font) diserahkan, setiap karakter di luar cakupan — pada
       teks dokumen MAUPUN string sisi temuan — diganti penanda
       ANNOT_PDF_PLACEHOLDER pada string tampil, dengan pengukuran
       dilakukan atas string tampil yang sama; tidak ada karakter yang
       dihapus atau diganti diam-diam, dan pengungkapannya dicetak
       (annotPdfDisclosure). Tanpa coverage, inventaris model bernilai
       null dan blok ini tidak mengganti apa pun (jalur font cadangan
       diatur lem UI dengan gerbang D6 yang sama).
       Ketergantungan (fungsi murni yang sudah ada, tidak diubah):
       diPdfCpInRanges + diReportFmtNum (REPORT-CORE);
       ANNOT_MANUAL_REVIEW_LABEL + ANNOT_UNANCHORED_NOTE (ANNOT-CORE).
       Masukan tidak pernah diubah; keluaran deterministik untuk
       measure yang deterministik. */
    var ANNOT_PDF_PLACEHOLDER = "\u2423"; /* ␣ OPEN BOX — termasuk cakupan subset font */
    var ANNOT_PDF_CHIP_LABELS = { omml: "rumus", field: "kolom isian", object: "objek tertanam" };
    var ANNOT_PDF_HL_FILL = [255, 238, 168];
    var ANNOT_PDF_PROPOSAL_FILL = [203, 236, 203];
    var ANNOT_PDF_NUM_COLOR = [29, 95, 209];
    var ANNOT_PDF_ADV_COLOR = [166, 110, 0];
    var ANNOT_PDF_ADV_LINE = [196, 132, 20];
    /* Penjelajah codepoint yang menghasilkan SEMUA karakter (termasuk
       whitespace tata letak) — berbeda dari diPdfEachChar yang melewati
       \n \r \t karena pra-cek tidak memerlukannya; substitusi tidak
       boleh membuang karakter apa pun. */
    function annotPdfEachCp(text, fn){
      var s = String(text == null ? "" : text);
      for(var i = 0; i < s.length; i++){
        var cp = s.codePointAt(i);
        fn(String.fromCodePoint(cp), cp, i);
        if(cp > 0xFFFF) i++;
      }
    }
    function annotPdfCpArray(text){
      var out = [];
      annotPdfEachCp(text, function(ch, cp, start){ out.push({ ch: ch, start: start, end: start + ch.length }); });
      return out;
    }
    /* Substitusi D-1: karakter di luar cakupan -> penanda, per
       codepoint, urutan dan jumlah kemunculan dipertahankan. */
    function annotPdfSubstitute(text, coverage){
      if(!coverage) return String(text == null ? "" : text);
      var out = "";
      annotPdfEachCp(text, function(ch, cp){
        if(cp === 0x0A || cp === 0x0D || cp === 0x09 || diPdfCpInRanges(coverage, cp)) out += ch;
        else out += ANNOT_PDF_PLACEHOLDER;
      });
      return out;
    }
    function annotPdfFileName(date){
      function p2(x){ return (x < 10 ? "0" : "") + x; }
      return "saksara-laporan-anotasi-" + date.getFullYear() + "-" + p2(date.getMonth() + 1) + "-" + p2(date.getDate()) + ".pdf";
    }
    /* Pengungkapan D-1 dari model: total kemunculan + rincian per
       karakter + lokasi per blok. null bila inventaris tidak tersedia
       (coverage tidak diserahkan) atau tidak ada karakter di luar
       cakupan. String rincian memuat karakter aslinya; perender
       menampilkannya lewat substitusi yang sama, sehingga yang
       tercetak adalah penanda + label codepoint-nya. */
    function annotPdfDisclosure(model){
      if(!model || !model.unsupported || !model.unsupported.length) return null;
      var total = 0;
      model.unsupported.forEach(function(u){ total += u.count; });
      function fmtList(list){
        return list.map(function(u){ return "'" + u.ch + "' (" + u.cp + ") \u00D7" + u.count; }).join(", ");
      }
      var lines = [];
      lines.push("Sebanyak " + total + " kemunculan karakter di luar cakupan font laporan diganti dengan penanda " + ANNOT_PDF_PLACEHOLDER + " pada laporan ini, agar tidak ada isi yang hilang diam-diam: " + fmtList(model.unsupported) + ". Tanda " + ANNOT_PDF_PLACEHOLDER + " bukan bagian dari teks asli.");
      (model.renderBlocks || []).forEach(function(rb, i){
        if(rb.unsupported && rb.unsupported.length){
          var loc;
          if(model.source && model.source.mode === "paste") loc = "Paragraf ke-" + (i + 1);
          else {
            loc = "Blok ke-" + (i + 1) + (rb.type ? " (" + rb.type + ")" : "");
            if(typeof rb.page === "number") loc += ", halaman asal " + rb.page;
          }
          lines.push(loc + ": " + fmtList(rb.unsupported));
        }
      });
      return { total: total, lines: lines };
    }
    /* annotPdfLayout(model, opts) — rencana gambar seluruh laporan.
       opts: { measure(textTampil, {size, bold}) -> lebar mm (WAJIB),
               coverage: rentang codepoint | null,
               display(text) -> text tampil (jalur font cadangan;
                 hanya dipakai bila coverage null),
               dateStr, editedNote: bool, fallbackNotice: string|null,
               stateLabels: {accepted|pending|rejected|read -> label},
               recommendations: [string], limitations: [string] }
       Keluaran: { pages: [[op...]...], pageCount, disclosure }.
       Op: {op:"text", x, y, text(tampil), size, bold, color, src}
           {op:"rect", x, y, w, h, fill, mark, kind:"hl"|"proposal"}
           {op:"rects", x, y, w, h, color, width}   (bingkai sel tabel)
           {op:"line", x1, y1, x2, y2, color, width, dash, mark}
           {op:"num", x, y, text, mark, color}      (nomor superskrip) */
    function annotPdfLayout(model, opts){
      opts = opts || {};
      var measure = opts.measure;
      var coverage = opts.coverage || null;
      function disp(t){
        t = String(t == null ? "" : t);
        return coverage ? annotPdfSubstitute(t, coverage) : (opts.display ? opts.display(t) : t);
      }
      function wmeasure(raw, size, bold){ return measure(disp(raw), { size: size, bold: !!bold }); }
      var M = 16, CW = 178, TOP = 18, BOT = 278, FIRST_BASE = 22;
      var pages = [[]];
      var Y = FIRST_BASE;
      function ops(){ return pages[pages.length - 1]; }
      function newPage(){ pages.push([]); Y = FIRST_BASE; }
      function sizeMm(size){ return size * 25.4 / 72; }
      function lhFor(size){ return sizeMm(size) * 1.5; }
      function T(x, y, raw, size, bold, color, src){
        var d = disp(raw);
        if(!d) return;
        ops().push({ op: "text", x: x, y: y, text: d, size: size, bold: !!bold, color: color || [0, 0, 0], src: src || null });
      }
      function RECT(x, y, w, h, fill, mark, kind, block){ ops().push({ op: "rect", x: x, y: y, w: w, h: h, fill: fill, mark: (mark == null ? null : mark), kind: kind || "hl", block: block || null }); }
      function LINE(x1, y1, x2, y2, color, width, dash, mark, block){ ops().push({ op: "line", x1: x1, y1: y1, x2: x2, y2: y2, color: color, width: width, dash: dash || null, mark: (mark == null ? null : mark), block: block || null }); }
      function NUM(x, y, n, color, block, markNo){ ops().push({ op: "num", x: x, y: y, text: String(n), mark: (markNo == null ? null : markNo), color: color, block: block || null }); }
      /* Tokenisasi kata/spasi untuk pembungkusan teks polos. */
      function tokensOf(text){
        var out = [], i = 0, s = String(text == null ? "" : text);
        while(i < s.length){
          var ch = s.charAt(i);
          if(ch === "\n"){ out.push({ t: "\n", brk: true }); i++; continue; }
          var isSp = (ch === " " || ch === "\t");
          var j = i + 1;
          while(j < s.length){ var c2 = s.charAt(j); if(c2 === "\n") break; if((c2 === " " || c2 === "\t") !== isSp) break; j++; }
          out.push({ t: s.slice(i, j), space: isSp });
          i = j;
        }
        return out;
      }
      function wrapPlain(text, width, size, bold){
        var lines = [], cur = "", curW = 0;
        function flush(){ lines.push(cur); cur = ""; curW = 0; }
        tokensOf(text).forEach(function(tk){
          if(tk.brk){ flush(); return; }
          var w = wmeasure(tk.t, size, bold);
          if(tk.space){
            if(curW + w <= width){ cur += tk.t; curW += w; }
            else if(cur) flush();
            return;
          }
          if(curW + w <= width){ cur += tk.t; curW += w; return; }
          if(w <= width){ flush(); cur = tk.t; curW = w; return; }
          annotPdfCpArray(tk.t).forEach(function(c){
            var cw = wmeasure(c.ch, size, bold);
            if(curW + cw > width && cur) flush();
            cur += c.ch; curW += cw;
          });
        });
        if(cur || !lines.length) lines.push(cur);
        return lines;
      }
      function emitPlain(text, size, bold, o){
        o = o || {};
        var x = (o.x != null ? o.x : M), width = o.width || CW, lh = o.lh || lhFor(size);
        wrapPlain(text, width, size, bold).forEach(function(ln){
          if(Y > BOT) newPage();
          T(x, Y, ln, size, bold, o.color);
          Y += lh;
        });
        if(o.gap) Y += o.gap;
      }
      function emitHeading(text, size, gapBefore){
        var lines = wrapPlain(text, CW, size, true);
        var need = lines.length * lhFor(size) + lhFor(size);
        if(Y > FIRST_BASE && Y + need > BOT) newPage();
        else if(gapBefore) Y += gapBefore;
        lines.forEach(function(ln){
          if(Y > BOT) newPage();
          T(M, Y, ln, size, true);
          Y += lhFor(size);
        });
        Y += 1.2;
      }
      function emitKv(rows){
        rows.forEach(function(row){
          var vlines = wrapPlain(row[1], CW - 58, 10.5, false);
          if(Y + Math.max(1, vlines.length) * lhFor(10.5) > BOT && Y > FIRST_BASE) newPage();
          T(M, Y, row[0], 10.5, true);
          vlines.forEach(function(vl, i){
            if(i > 0){ Y += lhFor(10.5); if(Y > BOT) newPage(); }
            T(72, Y, vl, 10.5, false);
          });
          Y += lhFor(10.5);
        });
        Y += 2;
      }
      /* ----- Mesin fragmen berpenanda (jantung satu-lintasan) -----
         Memecah teks blok pada gabungan batas segmen gaya + batas
         penanda, membungkusnya menjadi baris, dan untuk setiap baris
         menghasilkan item teks + rect/garis/nomor dari geometri
         fragmen yang sama. */
      function blockLines(text, segments, marks, o){
        var size = o.size, lh = o.lh || lhFor(size), smm = sizeMm(size);
        text = String(text == null ? "" : text);
        var len = text.length;
        var boundMap = { 0: 1 };
        if(len) boundMap[len] = 1;
        (segments || []).forEach(function(sg){ boundMap[Math.max(0, Math.min(len, sg.start))] = 1; boundMap[Math.max(0, Math.min(len, sg.end))] = 1; });
        (marks || []).forEach(function(mk){ boundMap[Math.max(0, Math.min(len, mk.start))] = 1; boundMap[Math.max(0, Math.min(len, mk.end))] = 1; });
        var pts = Object.keys(boundMap).map(function(k){ return Number(k); }).sort(function(a, b){ return a - b; });
        var chips = {};
        (segments || []).forEach(function(sg){
          if(sg.protected && sg.start === sg.end)
            chips[sg.start] = "[" + (ANNOT_PDF_CHIP_LABELS[sg.kind] || "elemen terlindungi") + " \u2014 tidak dianalisis]";
        });
        function styleAt(pos){
          var st = { bold: !!o.boldAll, italic: false, underline: false };
          (segments || []).forEach(function(sg){
            if(sg.protected) return;
            if(sg.start <= pos && pos < sg.end){
              if(sg.bold) st.bold = true;
              if(sg.italic) st.italic = true;
              if(sg.underline) st.underline = true;
            }
          });
          return st;
        }
        function marksAt(s, e){
          var out = [];
          (marks || []).forEach(function(mk){ if(mk.start <= s && e <= mk.end) out.push(mk); });
          return out;
        }
        var pieces = [];
        for(var pi = 0; pi < pts.length; pi++){
          var p = pts[pi];
          if(chips[p] != null)
            pieces.push({ start: p, end: p, chip: true, text: chips[p], marks: [], style: { bold: false, italic: false, underline: false }, space: false });
          if(pi + 1 >= pts.length) break;
          var s = p, e = pts[pi + 1];
          if(e <= s) continue;
          var st = styleAt(s), mk = marksAt(s, e);
          var j = s;
          while(j < e){
            var ch = text.charAt(j);
            if(ch === "\n"){ pieces.push({ start: j, end: j + 1, brk: true, text: "", marks: [], style: st, space: false }); j++; continue; }
            var isSp = (ch === " " || ch === "\t");
            var k = j + 1;
            while(k < e){ var c2 = text.charAt(k); if(c2 === "\n") break; if((c2 === " " || c2 === "\t") !== isSp) break; k++; }
            pieces.push({ start: j, end: k, text: text.slice(j, k), marks: mk, style: st, space: isSp });
            j = k;
          }
        }
        pieces.forEach(function(pc){ pc.w = pc.brk ? 0 : wmeasure(pc.text, size, pc.style.bold); });
        var lines = [], cur = null, numbered = {};
        function newLine(){ cur = { items: [], rects: [], ulines: [], nums: [], lh: lh, sizeMm: smm, size: size, w: 0, block: o.blockKey || null }; lines.push(cur); }
        newLine();
        function place(pc, x){
          cur.items.push({ x: x, w: pc.w, text: pc.text, bold: pc.style.bold, italic: !!pc.style.italic,
            color: pc.chip ? [96, 102, 110] : null, src: pc.chip ? null : { block: o.blockKey || null, start: pc.start, end: pc.end }, chip: !!pc.chip });
          pc.marks.forEach(function(mk){
            if(mk.kind === "proposal"){ cur.rects.push({ x: x, w: pc.w, mark: mk.no, kind: "proposal" }); return; }
            if(mk.advisory) cur.ulines.push({ x: x, w: pc.w, mark: mk.no, dash: [0.8, 0.8], color: ANNOT_PDF_ADV_LINE });
            else cur.rects.push({ x: x, w: pc.w, mark: mk.no, kind: "hl" });
            if(!o.suppressNums && !numbered[mk.no]){
              numbered[mk.no] = 1;
              cur.nums.push({ x: x, text: String(mk.no), mark: mk.no, color: mk.advisory ? ANNOT_PDF_ADV_COLOR : ANNOT_PDF_NUM_COLOR });
            }
          });
          if(pc.style.underline && !pc.space)
            cur.ulines.push({ x: x, w: pc.w, mark: null, dash: null, color: [80, 80, 80] });
          cur.w = Math.max(cur.w, x + pc.w);
        }
        var idx = 0;
        while(idx < pieces.length){
          var pc0 = pieces[idx];
          if(pc0.brk){ newLine(); idx++; continue; }
          if(pc0.space){
            if(cur.w + pc0.w <= o.width || !cur.items.length){ place(pc0, cur.w); idx++; }
            else { newLine(); if(pc0.marks.length) place(pc0, 0); idx++; }
            continue;
          }
          var word = [], ww = 0, j2 = idx;
          while(j2 < pieces.length && !pieces[j2].space && !pieces[j2].brk){ word.push(pieces[j2]); ww += pieces[j2].w; j2++; }
          if(cur.w + ww <= o.width){
            word.forEach(function(wp){ place(wp, cur.w); });
            idx = j2;
          } else if(ww <= o.width){
            newLine();
            word.forEach(function(wp){ place(wp, cur.w); });
            idx = j2;
          } else {
            var rest = word.slice();
            while(rest.length){
              var avail = o.width - cur.w, first = rest[0];
              if(first.w <= avail){ place(first, cur.w); rest = rest.slice(1); continue; }
              var cps = annotPdfCpArray(first.text);
              var acc = "", accW = 0, used = 0;
              for(var ci = 0; ci < cps.length; ci++){
                var cw2 = wmeasure(cps[ci].ch, size, first.style.bold);
                if(accW + cw2 > avail && acc) break;
                acc += cps[ci].ch; accW += cw2; used++;
                if(accW > avail) break;
              }
              if(!acc){ newLine(); continue; }
              var subEnd = first.start + cps[used - 1].end;
              place({ start: first.start, end: subEnd, text: acc, marks: first.marks, style: first.style, space: false, chip: first.chip, w: accW }, cur.w);
              var remainText = first.text.slice(cps[used - 1].end);
              if(remainText)
                rest = [{ start: subEnd, end: first.end, text: remainText, marks: first.marks, style: first.style, space: false, chip: first.chip, w: wmeasure(remainText, size, first.style.bold) }].concat(rest.slice(1));
              else rest = rest.slice(1);
              if(rest.length) newLine();
            }
            idx = j2;
          }
        }
        /* Penanda nol-lebar (rentang sisipan): jangkar pada baris yang
           memuat offset-nya, digambar sebagai sisipan tipis + nomor. */
        (marks || []).forEach(function(mk){
          if(mk.start !== mk.end) return;
          var target = null, tx = 0;
          for(var li = 0; li < lines.length; li++){
            var its = lines[li].items, lo = null, hi = null;
            its.forEach(function(it){
              if(!it.src) return;
              if(lo === null || it.src.start < lo) lo = it.src.start;
              if(hi === null || it.src.end > hi) hi = it.src.end;
            });
            if(lo === null) continue;
            if(mk.start >= lo && mk.start <= hi){
              target = lines[li]; tx = 0;
              its.forEach(function(it){ if(it.src && it.src.end <= mk.start) tx = Math.max(tx, it.x + it.w); });
              break;
            }
          }
          if(!target && lines.length) target = lines[lines.length - 1];
          if(!target) return;
          if(mk.kind === "proposal") return;
          if(mk.advisory) target.ulines.push({ x: tx, w: 0.7, mark: mk.no, dash: [0.8, 0.8], color: ANNOT_PDF_ADV_LINE });
          else target.rects.push({ x: tx, w: 0.7, mark: mk.no, kind: "hl" });
          if(!o.suppressNums && !numbered[mk.no]){
            numbered[mk.no] = 1;
            target.nums.push({ x: tx, text: String(mk.no), mark: mk.no, color: mk.advisory ? ANNOT_PDF_ADV_COLOR : ANNOT_PDF_NUM_COLOR });
          }
        });
        return { lines: lines, lh: lh, sizeMm: smm, size: size };
      }
      function pushLine(line, x0, base){
        var smm = line.sizeMm;
        line.rects.forEach(function(r){ RECT(x0 + r.x, base - smm * 0.80, r.w, smm * 1.04, r.kind === "proposal" ? ANNOT_PDF_PROPOSAL_FILL : ANNOT_PDF_HL_FILL, r.mark, r.kind, line.block); });
        line.ulines.forEach(function(u){ LINE(x0 + u.x, base + smm * 0.30, x0 + u.x + u.w, base + smm * 0.30, u.color, u.dash ? 0.32 : 0.22, u.dash, u.mark, line.block); });
        line.items.forEach(function(it){ T(x0 + it.x, base, it.text, line.size, it.bold, it.color, it.src); });
        line.nums.forEach(function(n){ NUM(x0 + n.x, base - smm * 0.95, n.text, n.color, line.block, n.mark); });
      }
      function emitBlockLines(L, x0, gapAfter, prefix){
        if(!L.lines.length){ Y += (gapAfter || 0); return; }
        var first = true;
        L.lines.forEach(function(line){
          if(Y > BOT) newPage();
          if(first && prefix) T(prefix.x, Y, prefix.text, L.size, false, [60, 60, 60]);
          first = false;
          pushLine(line, x0, Y);
          Y += line.lh;
        });
        Y += (gapAfter || 0);
      }
      /* ----- Halaman 1: kepala + kejujuran + ringkasan ----- */
      var src = model.source || {};
      var totals = model.totals || { findings: 0, withProposal: 0, manualReview: 0, unanchored: 0 };
      T(M, Y, "Saksara", 16, true, [29, 95, 209]);
      Y += 8;
      T(M, Y, "LAPORAN ANOTASI TULISAN", 13.5, true);
      Y += 6.5;
      emitPlain("Asisten Menulis \u00B7 Saksara", 9.5, false, { color: [110, 110, 110], lh: 4.6 });
      emitPlain("Dibuat lokal di peramban \u00B7 " + (opts.dateStr || "") + " \u00B7 saksara.vercel.app", 9.5, false, { color: [110, 110, 110], lh: 4.6, gap: 1 });
      LINE(M, Y, M + CW, Y, [160, 160, 160], 0.25, null, null);
      Y += 5;
      if(opts.fallbackNotice) emitPlain(opts.fallbackNotice, 10, false, { gap: 2 });
      var honesty = "Teks di bawah adalah teks yang dianalisis, utuh dan tidak diubah. Sorotan dan nomor adalah penanda saran \u2014 bukan perubahan otomatis. Pemisahan halaman mengikuti tata letak laporan ini, bukan dokumen asli.";
      if(src.mode === "pdf") honesty += " Untuk dokumen yang diimpor dari PDF, teks adalah hasil ekstraksi per halaman dan disusun ulang sebagai teks mengalir \u2014 bukan tampilan visual PDF asli.";
      if(opts.editedNote) honesty += " Perhatian: teks pada kotak tulis telah berubah sejak analisis terakhir; laporan ini mencetak teks persis seperti yang dianalisis, sehingga penanda tetap tepat untuk teks yang tercetak di sini.";
      if(src.analysisTruncated) honesty += " Cakupan: analisis internal terpotong pada batas 50.000 karakter.";
      if(src.docTruncated) honesty += " Cakupan: dokumen dipotong pada batas blok; blok selebihnya belum dianalisis.";
      emitPlain(honesty, 10, false, { gap: 3 });
      emitHeading("Ringkasan", 12, 0);
      var rows = [];
      if(src.fileName) rows.push(["Dokumen", String(src.fileName)]);
      rows.push(["Total temuan", diReportFmtNum(totals.findings || 0)]);
      var certCounts = {}, certOrder = [];
      (model.findings || []).forEach(function(f){
        var lbl = f.certaintyLabel || f.certainty || "";
        if(!(lbl in certCounts)){ certCounts[lbl] = 0; certOrder.push(lbl); }
        certCounts[lbl]++;
      });
      certOrder.forEach(function(lbl){ rows.push([lbl, diReportFmtNum(certCounts[lbl])]); });
      rows.push(["Dengan usulan perbaikan", diReportFmtNum(totals.withProposal || 0)]);
      rows.push(["Perlu ditinjau manual", diReportFmtNum(totals.manualReview || 0)]);
      if(totals.unanchored) rows.push(["Tanpa penanda pada dokumen", diReportFmtNum(totals.unanchored)]);
      rows.push(["Karakter dianalisis", diReportFmtNum(src.analyzedChars || 0)]);
      emitKv(rows);
      var disclosure = coverage ? annotPdfDisclosure(model) : null;
      if(disclosure){
        emitHeading("Pengungkapan Karakter", 12, 2);
        disclosure.lines.forEach(function(ln){ emitPlain(ln, 10, false, { gap: 1 }); });
        Y += 2;
      }
      /* ----- Bagian A: Dokumen Bertanda ----- */
      emitHeading("Dokumen Bertanda", 12, 3);
      if(src.mode === "pdf")
        emitPlain("Teks berikut adalah hasil ekstraksi per halaman dari berkas PDF asal, disusun ulang sebagai teks mengalir.", 9.5, false, { color: [110, 110, 110], gap: 2 });
      var blocks = model.renderBlocks || [];
      if(!blocks.length)
        emitPlain("Tidak ada teks yang dianalisis.", 10.5, false, { gap: 2 });
      var listCounter = 0, lastListKey = null, lastPage = null;
      function renderFlowBlock(blk){
        if(blk.type === "heading"){
          var hsize = blk.level === 1 ? 15 : blk.level === 2 ? 13.5 : blk.level === 3 ? 12 : 11;
          if(Y + lhFor(hsize) * 1.6 > BOT && Y > FIRST_BASE) newPage();
          Y += 2.5;
          emitBlockLines(blockLines(blk.text, blk.segments, blk.marks, { width: CW, size: hsize, lh: lhFor(hsize) * 1.15, boldAll: true, blockKey: blk.key }), M, 1.5);
          listCounter = 0; lastListKey = null;
        } else if(blk.type === "list-item"){
          var key = (blk.listKind || "bullet") + ":" + (blk.level || 0);
          if(key !== lastListKey){ listCounter = 0; lastListKey = key; }
          var prefixText;
          if(blk.listKind === "number"){ listCounter++; prefixText = listCounter + "."; }
          else prefixText = "\u2022";
          var indent = 7 + (blk.level || 0) * 5;
          emitBlockLines(blockLines(blk.text, blk.segments, blk.marks, { width: CW - indent, size: 10.5, lh: 6.0, blockKey: blk.key }),
            M + indent, 1.2, { text: prefixText, x: M + (blk.level || 0) * 5 });
          /* listCounter/lastListKey sengaja TIDAK diatur ulang di sini:
             butir berurutan harus meneruskan penomoran. */
        } else {
          emitBlockLines(blockLines(blk.text, blk.segments, blk.marks, { width: CW, size: 10.5, lh: 6.0, blockKey: blk.key }), M, 2.2);
          listCounter = 0; lastListKey = null;
        }
      }
      function renderTable(cellMap, ncols){
        var colW = CW / ncols, pad = 1.6, tsize = 10, tlh = lhFor(tsize), tsmm = sizeMm(tsize);
        var rowIdx = Object.keys(cellMap).map(function(k){ return Number(k); }).sort(function(a, b){ return a - b; });
        rowIdx.forEach(function(r){
          var cellLines = [], maxLines = 0, c;
          for(c = 0; c < ncols; c++){
            var cblocks = cellMap[r] && cellMap[r][c] ? cellMap[r][c] : [];
            var ls = [];
            cblocks.forEach(function(b, bi2){
              var L = blockLines(b.text, b.segments, b.marks, { width: colW - 2 * pad, size: tsize, lh: tlh, blockKey: b.key });
              L.lines.forEach(function(l){ ls.push(l); });
              if(bi2 < cblocks.length - 1) ls.push(null);
            });
            if(!ls.length) ls = [null];
            cellLines.push(ls);
            if(ls.length > maxLines) maxLines = ls.length;
          }
          var done = 0;
          while(done < maxLines){
            var avail = BOT - Y;
            var fit = Math.floor((avail - 2 * pad) / tlh);
            if(fit <= 0){ newPage(); continue; }
            var take = Math.min(fit, maxLines - done);
            for(c = 0; c < ncols; c++)
              ops().push({ op: "rects", x: M + c * colW, y: Y - tsmm - 0.6, w: colW, h: take * tlh + tsmm * 0.6, color: [170, 175, 182], width: 0.25 });
            for(var s2 = 0; s2 < take; s2++){
              var base = Y + s2 * tlh;
              for(c = 0; c < ncols; c++){
                var line = cellLines[c][done + s2];
                if(line) pushLine(line, M + c * colW + pad, base);
              }
            }
            Y += take * tlh + 1.2;
            done += take;
          }
        });
        Y += 2;
        listCounter = 0; lastListKey = null;
      }
      var bi = 0;
      while(bi < blocks.length){
        var blk = blocks[bi];
        if(typeof blk.page === "number" && blk.page !== lastPage){
          lastPage = blk.page;
          emitPlain("\u2014 Halaman " + blk.page + " pada dokumen asal \u2014", 8.5, false, { color: [120, 120, 120], lh: 4.4, gap: 1 });
        }
        if(blk.type === "table-cell" && blk.tableRef && typeof blk.tableRef.table === "number"){
          var tIdx = blk.tableRef.table, cellMap = {}, maxCol = -1, bj = bi;
          while(bj < blocks.length && blocks[bj].type === "table-cell" && blocks[bj].tableRef && blocks[bj].tableRef.table === tIdx){
            var cb = blocks[bj], rr = cb.tableRef.r || 0, cc = cb.tableRef.c || 0;
            if(!cellMap[rr]) cellMap[rr] = {};
            if(!cellMap[rr][cc]) cellMap[rr][cc] = [];
            cellMap[rr][cc].push(cb);
            if(cc > maxCol) maxCol = cc;
            bj++;
          }
          renderTable(cellMap, maxCol + 1);
          bi = bj;
          continue;
        }
        renderFlowBlock(blk);
        bi++;
      }
      /* ----- Bagian B: Daftar Temuan ----- */
      emitHeading("Daftar Temuan", 12, 5);
      var stateLabels = opts.stateLabels || {};
      function pad2n(n){ return (n < 10 ? "0" : "") + n; }
      if(!(model.findings || []).length)
        emitPlain("Tidak ditemukan saran untuk teks ini.", 10.5, false, { gap: 2 });
      (model.findings || []).forEach(function(f){
        if(BOT - Y < 34 && Y > FIRST_BASE) newPage();
        emitPlain("TEMUAN " + pad2n(f.no) + " \u2014 " + f.kindLabel + " \u00B7 " + f.certaintyLabel, 10.5, true, { gap: 0.6 });
        var loc = "Lokasi: Paragraf ke-" + f.paragraphNo;
        if(f.anchor && f.anchor.type === "block" && typeof f.anchor.page === "number")
          loc += " \u00B7 dari halaman " + f.anchor.page + " dokumen asal";
        if(f.anchor && f.anchor.type === "none")
          loc += " \u00B7 " + (f.anchor.note || ANNOT_UNANCHORED_NOTE);
        else
          loc += " \u00B7 penanda " + f.no + " pada Dokumen Bertanda";
        emitPlain(loc, 9.5, false, { color: [90, 90, 90], lh: 4.8, gap: 1.2 });
        emitPlain("Kalimat asli:", 10, true, { gap: 0.2 });
        emitBlockLines(blockLines(f.sentenceText,
          [{ start: 0, end: String(f.sentenceText || "").length }],
          [{ no: f.no, start: f.rangeInSentence.start, end: f.rangeInSentence.end, advisory: !!f.advisory }],
          { width: CW, size: 10.5, lh: 5.8, suppressNums: true, blockKey: "f" + f.no + "-kal" }), M, 1.2);
        emitPlain("Mengapa perlu diperbaiki:", 10, true, { gap: 0.2 });
        emitPlain(f.explanation || "", 10.5, false, { gap: 1.2 });
        emitPlain("Usulan perbaikan:", 10, true, { gap: 0.2 });
        if(f.manualReview || f.proposedSentence == null){
          emitPlain(ANNOT_MANUAL_REVIEW_LABEL, 10.5, true, { gap: 0.4 });
          emitPlain("Tidak ada usulan otomatis untuk temuan ini \u2014 periksalah kalimat di atas dan putuskan sendiri perbaikannya.", 10, false, { gap: 1.2 });
        } else {
          var rs = f.rangeInSentence.start;
          var rl = f.proposedSentence.length - (f.sentenceText.length - (f.rangeInSentence.end - f.rangeInSentence.start));
          emitBlockLines(blockLines(f.proposedSentence,
            [{ start: 0, end: f.proposedSentence.length }],
            [{ no: f.no, start: rs, end: rs + rl, kind: "proposal" }],
            { width: CW, size: 10.5, lh: 5.8, suppressNums: true, blockKey: "f" + f.no + "-usulan" }), M, 1.2);
        }
        if(f.sharedSentence)
          emitPlain("Catatan: kalimat ini memuat temuan lain; usulan di atas hanya menerapkan temuan ini.", 9.5, false, { gap: 0.8 });
        emitPlain("Status: saran \u2014 bukan perubahan otomatis. Keputusan Anda: " + (stateLabels[f.state] || f.state) + ".", 9.5, false, { color: [90, 90, 90], lh: 4.8, gap: 3.5 });
      });
      /* ----- Bagian C: Penutup ----- */
      emitHeading("Rekomendasi", 12, 5);
      (opts.recommendations || []).forEach(function(r){ emitPlain("\u2022 " + r, 10.5, false, { lh: 5.6 }); });
      emitHeading("Keterbatasan Analisis", 12, 4);
      var lims = (opts.limitations || []).slice();
      if(coverage)
        lims.push("Karakter di luar cakupan font laporan diganti penanda " + ANNOT_PDF_PLACEHOLDER + " (lihat Pengungkapan Karakter) \u2014 tidak ada karakter yang dihapus diam-diam.");
      lims.push("Run miring (italic) pada dokumen asal dicetak tegak; subset font laporan hanya menyediakan gaya normal dan tebal. Ketebalan run dan garis bawah dipertahankan.");
      if(src.mode === "docx")
        lims.push("Penomoran daftar pada Dokumen Bertanda digenerasi ulang secara berurutan; penomoran asli Word yang berlanjut atau mengulang antarblok dapat berbeda.");
      lims.push("Sorotan dihitung dari tata letak laporan ini sendiri, sehingga posisi penanda selalu mengacu pada teks yang tercetak di halaman yang sama.");
      lims.forEach(function(r){ emitPlain("\u2022 " + r, 10.5, false, { lh: 5.6 }); });
      emitPlain("Laporan ini adalah bantuan analisis tulisan \u2014 bukan keputusan akademik yang mutlak.", 10.5, false, { gap: 2 });
      return { pages: pages, pageCount: pages.length, disclosure: disclosure };
    }
    /* ANNOT-PDF-CORE-END */

    /* FAITHFUL-CORE-START — Ekspor setia-asli (D8 Tahap 3): fungsi MURNI
       pembangun ekspor yang mempertahankan berkas asal. Untuk dokumen
       Word: bedah word/document.xml dari paket ASAL (sorotan +
       nomor superskrip pada run yang tepat, bagian "Rekomendasi
       Perbaikan" ditambahkan di akhir isi) lalu paket ditulis ulang
       dengan semua bagian lain byte-identik. Untuk PDF: geometri
       sorotan diturunkan dari item teks pdf.js yang SUDAH diekstrak
       saat impor (dicerminkan dari fungsi DI-CORE yang sama dan
       diverifikasi persis terhadap teks model sebelum dipercaya).
       Blok ini tidak menggambar dan tidak menyentuh DOM; penggambaran
       PDF (pdf-lib) dan unduhan berada di lem lapisan UI. WI-CORE,
       DI-CORE, REPORT-CORE, ANNOT-CORE, dan ANNOT-PDF-CORE tidak
       diubah; hasil analisis tidak pernah dihitung ulang di sini —
       masukan adalah model annotBuildReport apa adanya. */
    var DI_FAITHFUL_HL_MECH = "yellow";
    var DI_FAITHFUL_HL_ADV = "cyan";

    /* ---------- ZIP: direktori pusat lengkap + penulis minimal ----------
       Pembaca menangkap crc/waktu/flags per entri (diZipRead DI-CORE
       tidak menyimpannya) agar penulis dapat menyalin data terkompresi
       entri yang tidak berubah PERSIS byte-per-byte. Entri pengganti
       ditulis dengan metode store (0) + CRC32 yang dihitung di sini. */
    function diFaithfulZipEntries(bytes){
      if(!bytes || typeof bytes.length !== "number" || bytes.length < 22)
        return diFail("zip-invalid", "Berkas terlalu kecil untuk menjadi dokumen .docx yang valid.");
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var len = bytes.length, eocd = -1, i;
      var start = Math.max(0, len - 65557);
      for(i = len - 22; i >= start; i--){
        if(view.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
      }
      if(eocd < 0)
        return diFail("zip-invalid", "Struktur arsip ZIP tidak ditemukan.");
      if(eocd >= 20 && (view.getUint32(eocd - 20, true) === 0x07064b50 || view.getUint32(eocd - 20, true) === 0x06064b50))
        return diFail("zip64", "Dokumen memakai format ZIP64 yang belum didukung.");
      var total = view.getUint16(eocd + 10, true);
      var cdSize = view.getUint32(eocd + 12, true);
      var cdOffset = view.getUint32(eocd + 16, true);
      if(total === 0xFFFF || cdSize === 0xFFFFFFFF || cdOffset === 0xFFFFFFFF)
        return diFail("zip64", "Dokumen memakai format ZIP64 yang belum didukung.");
      if(total > DI_CAPS.maxEntries)
        return diFail("zip-too-many-entries", "Dokumen memuat terlalu banyak bagian internal.");
      var decoder = new TextDecoder("utf-8");
      var entries = [], pos = cdOffset, e;
      for(e = 0; e < total; e++){
        if(pos + 46 > len || view.getUint32(pos, true) !== 0x02014b50)
          return diFail("zip-invalid", "Struktur arsip dokumen rusak — direktori pusat tidak valid.");
        var flags = view.getUint16(pos + 8, true);
        if(flags & 0x0001)
          return diFail("zip-encrypted", "Dokumen terenkripsi atau dilindungi kata sandi sehingga tidak dapat dibaca.");
        var method = view.getUint16(pos + 10, true);
        var time = view.getUint16(pos + 12, true);
        var date = view.getUint16(pos + 14, true);
        var crc = view.getUint32(pos + 16, true);
        var compSize = view.getUint32(pos + 20, true);
        var size = view.getUint32(pos + 24, true);
        if(compSize === 0xFFFFFFFF || size === 0xFFFFFFFF)
          return diFail("zip64", "Dokumen memakai format ZIP64 yang belum didukung.");
        var nameLen = view.getUint16(pos + 28, true);
        var extraLen = view.getUint16(pos + 30, true);
        var commentLen = view.getUint16(pos + 32, true);
        var localOffset = view.getUint32(pos + 42, true);
        var name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
        if(localOffset + 30 > len || view.getUint32(localOffset, true) !== 0x04034b50)
          return diFail("zip-invalid", "Struktur arsip dokumen rusak — header lokal tidak valid.");
        var lNameLen = view.getUint16(localOffset + 26, true);
        var lExtraLen = view.getUint16(localOffset + 28, true);
        entries.push({ name: name, flags: flags, method: method, time: time, date: date,
          crc: crc, compSize: compSize, size: size,
          dataStart: localOffset + 30 + lNameLen + lExtraLen });
        pos += 46 + nameLen + extraLen + commentLen;
      }
      return { ok: true, entries: entries };
    }
    var DI_FAITHFUL_CRC_TABLE = (function(){
      var t = new Uint32Array(256);
      for(var n = 0; n < 256; n++){
        var c = n;
        for(var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      return t;
    })();
    function diFaithfulCrc32(bytes){
      var c = 0xFFFFFFFF;
      for(var i = 0; i < bytes.length; i++)
        c = DI_FAITHFUL_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function diFaithfulConcatBytes(chunks){
      var total = 0, i;
      for(i = 0; i < chunks.length; i++) total += chunks[i].length;
      var out = new Uint8Array(total), o = 0;
      for(i = 0; i < chunks.length; i++){ out.set(chunks[i], o); o += chunks[i].length; }
      return out;
    }
    /* replacements: { namaBagian: Uint8Array } — bagian lain disalin
       sebagai data terkompresi mentah dari berkas asal (byte-identik). */
    function diFaithfulZipWrite(bytes, entries, replacements){
      var enc = new TextEncoder();
      var chunks = [], centrals = [], offset = 0;
      entries.forEach(function(en){
        var nameBytes = enc.encode(en.name);
        var isRep = replacements && Object.prototype.hasOwnProperty.call(replacements, en.name);
        var method, crc, comp, size;
        if(isRep){
          var data = replacements[en.name];
          method = 0; crc = diFaithfulCrc32(data); comp = data; size = data.length;
        } else {
          method = en.method; crc = en.crc; size = en.size;
          comp = bytes.subarray(en.dataStart, en.dataStart + en.compSize);
        }
        var flags = en.flags & 0x0800; /* pertahankan hanya bit nama UTF-8 */
        var lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
        lh.setUint16(6, flags, true); lh.setUint16(8, method, true);
        lh.setUint16(10, en.time, true); lh.setUint16(12, en.date, true);
        lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true);
        lh.setUint32(22, size, true); lh.setUint16(26, nameBytes.length, true);
        chunks.push(new Uint8Array(lh.buffer), nameBytes, comp);
        var ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true); ch.setUint16(8, flags, true);
        ch.setUint16(10, method, true); ch.setUint16(12, en.time, true);
        ch.setUint16(14, en.date, true); ch.setUint32(16, crc, true);
        ch.setUint32(20, comp.length, true); ch.setUint32(24, size, true);
        ch.setUint16(28, nameBytes.length, true); ch.setUint32(42, offset, true);
        centrals.push(new Uint8Array(ch.buffer), nameBytes);
        offset += 30 + nameBytes.length + comp.length;
      });
      var cd = diFaithfulConcatBytes(centrals);
      var eocd = new DataView(new ArrayBuffer(22));
      eocd.setUint32(0, 0x06054b50, true);
      eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
      eocd.setUint32(12, cd.length, true); eocd.setUint32(16, offset, true);
      chunks.push(cd, new Uint8Array(eocd.buffer));
      return diFaithfulConcatBytes(chunks);
    }

    /* ---------- Temuan yang disertakan + isi rekomendasi (bahasa sederhana) ----------
       Temuan yang DITOLAK pengguna tidak disorot dan tidak didaftar —
       pengguna sudah memutuskan. Temuan berjangkar diberi nomor urut
       dokumen baru (1..M) yang konsisten antara sorotan dan daftar;
       temuan tanpa jangkar didaftar di bagian akhir daftar tanpa nomor
       dengan penjelasan sederhana. */
    function diFaithfulIncluded(A){
      var anchored = [], unanchored = [], marksByBlock = {};
      var noByFindingNo = {};
      ((A && A.findings) || []).forEach(function(f){
        if(f.state === "rejected") return;
        if(f.anchor && f.anchor.type !== "none"){ anchored.push(f); noByFindingNo[f.no] = anchored.length; }
        else unanchored.push(f);
      });
      ((A && A.renderBlocks) || []).forEach(function(rb, bi){
        (rb.marks || []).forEach(function(mk){
          var no = noByFindingNo[mk.no];
          if(!no) return;
          (marksByBlock[bi] = marksByBlock[bi] || []).push(
            { no: no, start: mk.start, end: mk.end, advisory: !!mk.advisory });
        });
      });
      Object.keys(marksByBlock).forEach(function(k){
        marksByBlock[k].sort(function(a, b){ return (a.start - b.start) || (a.end - b.end) || (a.no - b.no); });
      });
      return { anchored: anchored, unanchored: unanchored,
        noByFindingNo: noByFindingNo, marksByBlock: marksByBlock };
    }
    function diFaithfulAppendix(A){
      var inc = diFaithfulIncluded(A);
      function item(f, no){
        return { no: no, sentence: f.sentenceText, reason: f.explanation || "",
          proposal: f.manualReview ? null : f.proposedSentence, manual: !!f.manualReview };
      }
      return {
        heading: "Rekomendasi Perbaikan",
        intro: "Bagian yang disorot kuning pada dokumen di atas adalah tulisan yang disarankan untuk diperbaiki. Sorotan biru muda artinya tulisan perlu ditinjau manual. Nomor kecil di samping sorotan merujuk ke rekomendasi di bawah ini.",
        items: inc.anchored.map(function(f){ return item(f, inc.noByFindingNo[f.no]); }),
        unanchoredIntro: inc.unanchored.length
          ? "Rekomendasi berikut tidak dapat ditandai pada dokumen karena teksnya berubah sesudah analisis:"
          : null,
        unanchoredItems: inc.unanchored.map(function(f){ return item(f, null); }),
        emptyNote: (inc.anchored.length + inc.unanchored.length) === 0
          ? "Tidak ada rekomendasi perbaikan untuk dokumen ini." : null
      };
    }
    function diFaithfulAppendixLines(A){
      var app = diFaithfulAppendix(A);
      var lines = [];
      lines.push({ text: app.heading, bold: true, size: 15, gapAfter: 8 });
      lines.push({ text: app.intro, bold: false, size: 10.5, gapAfter: 10 });
      function pushItem(it){
        lines.push({ text: (it.no != null ? it.no + ". " : "") + "Kalimat asli: \"" + it.sentence + "\"",
          bold: false, size: 10.5, gapAfter: 2 });
        lines.push({ text: "Alasan: " + it.reason, bold: false, size: 10.5, gapAfter: 2 });
        if(it.manual) lines.push({ text: "Perlu ditinjau manual.", bold: true, size: 10.5, gapAfter: 8 });
        else lines.push({ text: "Usulan perbaikan: \"" + it.proposal + "\"", bold: false, size: 10.5, gapAfter: 8 });
      }
      app.items.forEach(pushItem);
      if(app.unanchoredIntro){
        lines.push({ text: app.unanchoredIntro, bold: false, size: 10.5, gapAfter: 6 });
        app.unanchoredItems.forEach(pushItem);
      }
      if(app.emptyNote) lines.push({ text: app.emptyNote, bold: false, size: 10.5, gapAfter: 4 });
      return lines;
    }
    function diFaithfulFileName(name){
      var n = String(name || "dokumen");
      var dot = n.lastIndexOf(".");
      var base = dot > 0 ? n.slice(0, dot) : n;
      var ext = dot > 0 ? n.slice(dot) : "";
      base = base.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
      if(!base) base = "dokumen";
      return base + "-beranotasi" + ext;
    }

    /* ---------- Rencana segmen satu paragraf (dipakai bedah DOCX + cadangan) ----------
       Potongan = gabungan batas semua penanda; segmen tersorot kuning
       bila memuat temuan mekanis, biru muda bila hanya penasihat.
       inserts: offset akhir penanda -> nomor yang disisipkan di sana. */
    function diFaithfulParaPlan(text, marks){
      marks = marks || [];
      var cutSet = { 0: 1 };
      cutSet[text.length] = 1;
      marks.forEach(function(m){ cutSet[m.start] = 1; cutSet[m.end] = 1; });
      var pts = Object.keys(cutSet).map(Number).sort(function(a, b){ return a - b; });
      var segments = [];
      for(var i = 0; i + 1 < pts.length; i++){
        var s = pts[i], e = pts[i + 1];
        if(e <= s) continue;
        var mech = false, adv = false;
        marks.forEach(function(m){
          if(m.start <= s && e <= m.end){ if(m.advisory) adv = true; else mech = true; }
        });
        segments.push({ start: s, end: e, hl: mech ? DI_FAITHFUL_HL_MECH : (adv ? DI_FAITHFUL_HL_ADV : null) });
      }
      var inserts = {};
      marks.forEach(function(m){ (inserts[m.end] = inserts[m.end] || []).push(m.no); });
      Object.keys(inserts).forEach(function(k){
        inserts[k].sort(function(a, b){ return a - b; });
      });
      return { segments: segments, inserts: inserts };
    }
    /* Potongan run model menurut rencana segmen — untuk pembangun
       cadangan berbasis model (docx). Menghasilkan potongan teks
       ber-hl + sisipan nomor { insertNo } pada posisi yang benar. */
    function diFaithfulBlockSegments(block, marks){
      var text = diBlockText(block);
      var plan = diFaithfulParaPlan(text, marks || []);
      var pieces = [];
      if(plan.inserts[0]) plan.inserts[0].forEach(function(no){ pieces.push({ insertNo: no }); });
      var pos = 0;
      (block.runs || []).forEach(function(r){
        if(r.protected){ if(r.text) pieces.push({ text: r.text, prot: true, kind: r.kind || null }); return; }
        var t = r.text || "";
        var rEnd = pos + t.length;
        plan.segments.forEach(function(sg){
          var s = Math.max(sg.start, pos), e = Math.min(sg.end, rEnd);
          if(e <= s) return;
          pieces.push({ text: t.slice(s - pos, e - pos), hl: sg.hl,
            bold: !!r.bold, italic: !!r.italic, underline: !!r.underline,
            fontName: r.fontName || null,
            fontSize: typeof r.fontSize === "number" ? r.fontSize : null,
            link: r.link || null });
          var ins = plan.inserts[e];
          if(ins && e > 0) ins.forEach(function(no){ pieces.push({ insertNo: no }); });
        });
        pos = rEnd;
      });
      return pieces;
    }

    /* ---------- DOCX: pengumpulan paragraf & teks (cermin urutan model) ----------
       Urutan pengumpulan menyalin persis diWalkBody/diTableBlock
       DI-CORE (anak body: p/tbl/sdt; sel tabel: p/tbl bersarang), dan
       teks paragraf dihitung dengan diWalkRuns/diRun yang sama dengan
       pembangun model — kesetaraan keduanya ditegaskan sebelum bedah. */
    var DI_FAITHFUL_RUN_CTX = { styles: {}, rels: {}, numbering: null };
    function diFaithfulCollectParas(root){
      var body = diFirst(root, "body") || root;
      var out = [];
      function fromTable(tbl){
        diKids(tbl, "tr").forEach(function(tr){
          diKids(tr, "tc").forEach(function(tc){
            (tc.children || []).forEach(function(ch){
              if(!ch.tag) return;
              if(ch.local === "p") out.push(ch);
              else if(ch.local === "tbl") fromTable(ch);
            });
          });
        });
      }
      function fromChildren(kids){
        (kids || []).forEach(function(el){
          if(!el.tag) return;
          if(el.local === "p") out.push(el);
          else if(el.local === "tbl") fromTable(el);
          else if(el.local === "sdt"){
            var c = diFirst(el, "sdtContent");
            if(c) fromChildren(c.children);
          }
        });
      }
      fromChildren(body.children);
      return out;
    }
    function diFaithfulParaText(pEl){
      var runs = [];
      diWalkRuns(pEl, DI_FAITHFUL_RUN_CTX, { link: null }, runs);
      var t = "";
      runs.forEach(function(r){ if(!r.protected) t += r.text; });
      return t;
    }
    /* Elemen w:r yang dikunjungi diWalkRuns, beserta induknya — cermin
       traversal yang sama (wadah transparan dijelajahi; fldSimple dan
       oMath/oMathPara adalah run terlindungi utuh, tidak diturunkan). */
    function diFaithfulRunEls(pEl){
      var out = [];
      function walk(el){
        var kids = el.children || [];
        for(var i = 0; i < kids.length; i++){
          var ch = kids[i];
          if(!ch.tag) continue;
          var ln = ch.local;
          if(DI_SKIP_RUN_PARENT[ln]) continue;
          if(ln === "r"){ out.push({ el: ch, parent: el }); continue; }
          if(ln === "fldSimple" || ln === "oMath" || ln === "oMathPara") continue;
          walk(ch);
        }
      }
      walk(pEl);
      return out;
    }
    function diFaithfulCloneEl(el){
      if(!el.tag) return { text: el.text || "" };
      var c = { tag: el.tag, local: el.local, attrs: {}, children: [] };
      for(var k in el.attrs) c.attrs[k] = el.attrs[k];
      c.children = (el.children || []).map(diFaithfulCloneEl);
      return c;
    }
    function diFaithfulXEl(pfx, local, attrs, children){
      return { tag: pfx + local, local: local, attrs: attrs || {}, children: children || [] };
    }
    function diFaithfulXText(t){ return { text: t }; }
    function diFaithfulXVal(pfx, v){ var a = {}; a[pfx + "val"] = v; return a; }
    function diFaithfulXNumRun(pfx, no){
      return diFaithfulXEl(pfx, "r", {}, [
        diFaithfulXEl(pfx, "rPr", {}, [
          diFaithfulXEl(pfx, "vertAlign", diFaithfulXVal(pfx, "superscript"), []),
          diFaithfulXEl(pfx, "sz", diFaithfulXVal(pfx, "16"), []),
          diFaithfulXEl(pfx, "color", diFaithfulXVal(pfx, "1D5FD1"), [])
        ]),
        diFaithfulXEl(pfx, "t", {}, [diFaithfulXText(String(no))])
      ]);
    }
    function diFaithfulXTextRun(pfx, text, opts){
      opts = opts || {};
      var kids = [];
      if(opts.bold) kids.push(diFaithfulXEl(pfx, "b", {}, []));
      if(opts.italic) kids.push(diFaithfulXEl(pfx, "i", {}, []));
      if(opts.sz) kids.push(diFaithfulXEl(pfx, "sz", diFaithfulXVal(pfx, String(opts.sz)), []));
      var runKids = [];
      if(kids.length) runKids.push(diFaithfulXEl(pfx, "rPr", {}, kids));
      runKids.push(diFaithfulXEl(pfx, "t", { "xml:space": "preserve" }, [diFaithfulXText(text)]));
      return diFaithfulXEl(pfx, "r", {}, runKids);
    }
    function diFaithfulXPara(pfx, runs){ return diFaithfulXEl(pfx, "p", {}, runs); }
    /* Run "sederhana" = teksnya hanya berasal dari anak w:t (selain
       rPr) sehingga aman dibelah pada batas karakter mana pun. Run
       yang memuat tab/br/sym/dll. adalah "rumit": hanya boleh utuh
       di dalam satu segmen (ditegaskan pemanggil). */
    function diFaithfulRunIsSimple(rEl){
      var kids = rEl.children || [];
      for(var i = 0; i < kids.length; i++){
        var ch = kids[i];
        if(!ch.tag) continue;
        if(ch.local === "rPr") continue;
        if(ch.local !== "t") return false;
      }
      return true;
    }
    function diFaithfulSetHighlight(rEl, pfx, color){
      var rPr = diFirst(rEl, "rPr");
      if(!rPr){ rPr = diFaithfulXEl(pfx, "rPr", {}, []); rEl.children.unshift(rPr); }
      var hl = null;
      (rPr.children || []).forEach(function(c){ if(c.tag && c.local === "highlight") hl = c; });
      if(!hl){ hl = diFaithfulXEl(pfx, "highlight", {}, []); rPr.children.push(hl); }
      hl.attrs = diFaithfulXVal(pfx, color);
    }
    function diFaithfulStripHighlights(pEl){
      diFaithfulRunEls(pEl).forEach(function(re){
        var rPr = diFirst(re.el, "rPr");
        if(rPr) rPr.children = (rPr.children || []).filter(function(c){
          return !(c.tag && c.local === "highlight");
        });
      });
    }
    function diFaithfulSplitRun(sp, plan, pfx){
      /* Kembalikan daftar {node, end}: klon run per potongan segmen,
         end = offset global akhir potongan (untuk sisipan nomor). */
      var nodes = [];
      plan.segments.forEach(function(sg){
        var s = Math.max(sg.start, sp.start), e = Math.min(sg.end, sp.end);
        if(e <= s) return;
        var clone = diFaithfulCloneEl(sp.re.el);
        var kept = [];
        var rPr = diFirst(clone, "rPr");
        if(rPr) kept.push(rPr);
        kept.push(diFaithfulXEl(pfx, "t", { "xml:space": "preserve" },
          [diFaithfulXText(sp.run.text.slice(s - sp.start, e - sp.start))]));
        clone.children = kept;
        if(sg.hl) diFaithfulSetHighlight(clone, pfx, sg.hl);
        nodes.push({ node: clone, end: e });
      });
      return nodes;
    }
    /* Terapkan rencana ke satu elemen paragraf. Mengembalikan false
       (bedah dibatalkan -> cadangan) bila ada batas segmen yang
       memotong bagian dalam run rumit. Pada paragraf yang ditandai,
       sorotan lama penulis dibersihkan dulu agar warna sorotan pada
       hasil adalah lapisan anotasi Saksara yang utuh dan dapat
       diverifikasi persis. */
    function diFaithfulApplyPara(pEl, text, marks, pfx){
      var plan = diFaithfulParaPlan(text, marks);
      var runEls = diFaithfulRunEls(pEl);
      var spans = [], pos = 0, i;
      for(i = 0; i < runEls.length; i++){
        var r = diRun(runEls[i].el, null);
        var len = (!r || r.protected) ? 0 : r.text.length;
        spans.push({ re: runEls[i], run: r, start: pos, end: pos + len,
          simple: len === 0 ? true : diFaithfulRunIsSimple(runEls[i].el) });
        pos += len;
      }
      if(pos !== text.length) return false;
      var cutSet = {};
      plan.segments.forEach(function(sg){ cutSet[sg.start] = 1; cutSet[sg.end] = 1; });
      for(i = 0; i < spans.length; i++){
        var sp = spans[i];
        if(sp.end - sp.start > 0 && !sp.simple){
          for(var c in cutSet){
            var cn = +c;
            if(sp.start < cn && cn < sp.end) return false;
          }
        }
      }
      diFaithfulStripHighlights(pEl);
      /* Sisipan pada offset 0 diletakkan sebelum run teks pertama. */
      if(plan.inserts[0] && spans.length){
        var first = null;
        for(i = 0; i < spans.length; i++) if(spans[i].end > spans[i].start){ first = spans[i]; break; }
        if(first){
          var at = first.re.parent.children.indexOf(first.re.el);
          if(at >= 0){
            var pre = plan.inserts[0].map(function(no){ return diFaithfulXNumRun(pfx, no); });
            first.re.parent.children.splice.apply(first.re.parent.children, [at, 0].concat(pre));
          }
        }
      }
      for(i = 0; i < spans.length; i++){
        var sp2 = spans[i];
        var nodes;
        if(sp2.end - sp2.start === 0){ nodes = [sp2.re.el]; }
        else if(sp2.simple){
          var pieces = diFaithfulSplitRun(sp2, plan, pfx);
          if(!pieces.length) return false;
          nodes = [];
          pieces.forEach(function(pc){
            nodes.push(pc.node);
            /* Nomor temuan yang berakhir DI TENGAH span disisipkan
               tepat sesudah potongan yang berakhir pada offset itu;
               yang berakhir pada akhir span ditangani extra di bawah. */
            var pn = plan.inserts[pc.end];
            if(pn && pc.end > sp2.start && pc.end < sp2.end)
              pn.forEach(function(no){ nodes.push(diFaithfulXNumRun(pfx, no)); });
          });
        }
        else {
          var seg = null;
          plan.segments.forEach(function(sg){ if(sg.start <= sp2.start && sp2.end <= sg.end) seg = sg; });
          if(seg && seg.hl) diFaithfulSetHighlight(sp2.re.el, pfx, seg.hl);
          nodes = [sp2.re.el];
        }
        var parent = sp2.re.parent;
        var idx = parent.children.indexOf(sp2.re.el);
        if(idx < 0) return false;
        var extra = [];
        var insNos = plan.inserts[sp2.end];
        if(insNos && sp2.end > sp2.start){
          /* Hanya span teks TERAKHIR yang berakhir pada offset ini
             yang menerima sisipan (span diurutkan; yang lain yang
             berakhir sama adalah span nol-lebar terlindungi). */
          var isLast = true;
          for(var j = i + 1; j < spans.length; j++)
            if(spans[j].end === sp2.end && spans[j].end > spans[j].start) isLast = false;
          if(isLast) insNos.forEach(function(no){ extra.push(diFaithfulXNumRun(pfx, no)); });
        }
        parent.children.splice.apply(parent.children, [idx, 1].concat(nodes).concat(extra));
      }
      return true;
    }
    function diFaithfulAppendixParas(A, pfx){
      var app = diFaithfulAppendix(A);
      var out = [];
      out.push(diFaithfulXPara(pfx, [diFaithfulXTextRun(pfx, app.heading, { bold: true, sz: 32 })]));
      out.push(diFaithfulXPara(pfx, [diFaithfulXTextRun(pfx, app.intro, {})]));
      function itemParas(it){
        var head = [];
        if(it.no != null) head.push(diFaithfulXTextRun(pfx, it.no + ". ", { bold: true }));
        head.push(diFaithfulXTextRun(pfx, "Kalimat asli: ", { bold: true }));
        head.push(diFaithfulXTextRun(pfx, "\"" + it.sentence + "\"", {}));
        out.push(diFaithfulXPara(pfx, head));
        out.push(diFaithfulXPara(pfx, [
          diFaithfulXTextRun(pfx, "Alasan: ", { bold: true }),
          diFaithfulXTextRun(pfx, it.reason, {})]));
        if(it.manual){
          out.push(diFaithfulXPara(pfx, [diFaithfulXTextRun(pfx, "Perlu ditinjau manual.", { bold: true })]));
        } else {
          out.push(diFaithfulXPara(pfx, [
            diFaithfulXTextRun(pfx, "Usulan perbaikan: ", { bold: true }),
            diFaithfulXTextRun(pfx, "\"" + it.proposal + "\"", {})]));
        }
      }
      app.items.forEach(itemParas);
      if(app.unanchoredIntro){
        out.push(diFaithfulXPara(pfx, [diFaithfulXTextRun(pfx, app.unanchoredIntro, { italic: true })]));
        app.unanchoredItems.forEach(itemParas);
      }
      if(app.emptyNote) out.push(diFaithfulXPara(pfx, [diFaithfulXTextRun(pfx, app.emptyNote, {})]));
      return out;
    }
    /* Bedah utama: bytes asal + model impor + model beranotasi ->
       Promise<{ ok:true, bytes, xml } | { ok:false, code, message }>. */
    function diFaithfulDocxSurgery(bytes, model, A, opts){
      opts = opts || {};
      var caps = diCapsWith(opts);
      var zr = diFaithfulZipEntries(bytes);
      if(!zr.ok) return Promise.resolve(zr);
      var docEntry = null;
      zr.entries.forEach(function(en){ if(en.name === "word/document.xml") docEntry = en; });
      if(!docEntry)
        return Promise.resolve(diFail("faithful-no-document", "Isi utama dokumen (word/document.xml) tidak ditemukan."));
      var inflateRaw = typeof opts.inflateRaw === "function" ? opts.inflateRaw : diInflateRawDefault;
      return diZipExtract(bytes, docEntry, caps, inflateRaw).then(function(x){
        if(!x.ok) return x;
        try {
          return diFaithfulDocxSurgeryXml(bytes, zr.entries, x.data, model, A);
        } catch(e){
          return diFail("faithful-surgery", "Penandaan dokumen tidak dapat dilakukan: " + (e && e.message ? e.message : e));
        }
      });
    }
    function diFaithfulDocxSurgeryXml(bytes, entries, docData, model, A){
      var xml = new TextDecoder("utf-8").decode(docData);
      var root = diParseXml(xml);
      var paras = diFaithfulCollectParas(root);
      var blocks = (model && model.blocks) || [];
      if(paras.length !== blocks.length)
        return diFail("faithful-align", "Jumlah paragraf dokumen tidak cocok dengan hasil impor — penandaan aman tidak dapat dilakukan.");
      var inc = diFaithfulIncluded(A);
      var pfx = "w:";
      if(paras.length){
        var t0 = paras[0].tag;
        pfx = t0.slice(0, t0.length - paras[0].local.length) || "w:";
      }
      for(var i = 0; i < blocks.length; i++){
        var text = diBlockText(blocks[i]);
        if(diFaithfulParaText(paras[i]) !== text)
          return diFail("faithful-align", "Teks paragraf dokumen tidak cocok dengan hasil impor — penandaan aman tidak dapat dilakukan.");
        var marks = inc.marksByBlock[i] || [];
        if(marks.length && !diFaithfulApplyPara(paras[i], text, marks, pfx))
          return diFail("faithful-complex", "Sebagian tulisan memakai susunan run yang rumit sehingga penandaan aman tidak dapat dilakukan.");
      }
      var body = diFirst(root, "body") || root;
      var appParas = diFaithfulAppendixParas(A, pfx);
      var sectIdx = -1;
      (body.children || []).forEach(function(c, ci){ if(c.tag && c.local === "sectPr") sectIdx = ci; });
      if(sectIdx >= 0) body.children.splice.apply(body.children, [sectIdx, 0].concat(appParas));
      else body.children.push.apply(body.children, appParas);
      var decl = xml.slice(0, 5) === "<?xml"
        ? xml.slice(0, xml.indexOf("?>") + 2) + "\n"
        : "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
      var newXml = decl + diSerializeXml(root);
      var repl = {};
      repl["word/document.xml"] = new TextEncoder().encode(newXml);
      return { ok: true, bytes: diFaithfulZipWrite(bytes, entries, repl), xml: newXml };
    }
    /* Teks paragraf yang diharapkan sesudah bedah: teks asal dengan
       nomor sisipan pada akhir setiap penanda (urutan menaik). */
    function diFaithfulExpectedText(text, marks){
      var byOff = {};
      (marks || []).forEach(function(m){ (byOff[m.end] = byOff[m.end] || []).push(m.no); });
      var offs = Object.keys(byOff).map(Number).sort(function(a, b){ return b - a; });
      var out = text;
      offs.forEach(function(off){
        var s = byOff[off].slice().sort(function(a, b){ return a - b; }).join("");
        out = out.slice(0, off) + s + out.slice(off);
      });
      return out;
    }
    function diFaithfulHighlightedTexts(pEl){
      var yellow = "", cyan = "";
      diFaithfulRunEls(pEl).forEach(function(re){
        var r = diRun(re.el, null);
        if(!r || r.protected) return;
        var rPr = diFirst(re.el, "rPr");
        var hl = rPr ? diFirst(rPr, "highlight") : null;
        var val = hl ? diAttr(hl, "val") : null;
        if(val === DI_FAITHFUL_HL_MECH) yellow += r.text;
        else if(val === DI_FAITHFUL_HL_ADV) cyan += r.text;
      });
      return { yellow: yellow, cyan: cyan };
    }
    /* Verifikasi hasil bedah: (1) semua bagian selain document.xml
       byte-identik; (2) impor ulang dengan pengurai aplikasi sendiri
       menghasilkan teks yang persis diharapkan (asal + nomor sisipan
       + bagian rekomendasi); (3) teks tersorot per warna pada XML
       hasil persis sama dengan gabungan segmen rencana. */
    function diFaithfulVerifyDocx(origBytes, outBytes, model, A, opts){
      var failures = [];
      var zo = diFaithfulZipEntries(origBytes), zn = diFaithfulZipEntries(outBytes);
      if(!zo.ok || !zn.ok) return Promise.resolve({ ok: false, failures: ["arsip hasil tidak terbaca"] });
      if(zo.entries.length !== zn.entries.length){
        failures.push("jumlah bagian arsip berubah");
      } else {
        zo.entries.forEach(function(eo, i){
          var en = zn.entries[i];
          if(eo.name !== en.name){ failures.push("nama bagian berubah: " + eo.name); return; }
          if(eo.name === "word/document.xml") return;
          if(eo.crc !== en.crc || eo.compSize !== en.compSize){ failures.push("bagian berubah: " + eo.name); return; }
          var a = origBytes.subarray(eo.dataStart, eo.dataStart + eo.compSize);
          var b = outBytes.subarray(en.dataStart, en.dataStart + en.compSize);
          for(var j = 0; j < a.length; j++) if(a[j] !== b[j]){ failures.push("byte bagian berubah: " + eo.name); break; }
        });
      }
      var inc = diFaithfulIncluded(A);
      var blocks = (model && model.blocks) || [];
      /* (3) cakupan sorotan dari XML hasil */
      var docEntry = null;
      zn.entries.forEach(function(en){ if(en.name === "word/document.xml") docEntry = en; });
      var hlInflate = typeof (opts || {}).inflateRaw === "function" ? opts.inflateRaw : diInflateRawDefault;
      var hlCheck = docEntry ? diZipExtract(outBytes, docEntry, diCapsWith(opts || {}), hlInflate).then(function(x){
        if(!x.ok){ failures.push("document.xml hasil tidak terbaca"); return; }
        var root;
        try { root = diParseXml(new TextDecoder("utf-8").decode(x.data)); }
        catch(e){ failures.push("document.xml hasil tidak terurai"); return; }
        var paras = diFaithfulCollectParas(root);
        for(var i = 0; i < blocks.length; i++){
          var marks = inc.marksByBlock[i] || [];
          if(!marks.length) continue;
          if(!paras[i]){ failures.push("paragraf hasil hilang: " + i); continue; }
          var plan = diFaithfulParaPlan(diBlockText(blocks[i]), marks);
          var expY = "", expC = "";
          plan.segments.forEach(function(sg){
            var t = diBlockText(blocks[i]).slice(sg.start, sg.end);
            if(sg.hl === DI_FAITHFUL_HL_MECH) expY += t;
            else if(sg.hl === DI_FAITHFUL_HL_ADV) expC += t;
          });
          var got = diFaithfulHighlightedTexts(paras[i]);
          if(got.yellow !== expY) failures.push("cakupan sorotan kuning paragraf " + i + " tidak persis");
          if(got.cyan !== expC) failures.push("cakupan sorotan biru muda paragraf " + i + " tidak persis");
        }
      }) : Promise.resolve();
      return hlCheck.then(function(){
        /* (2) impor ulang */
        return diParseDocx(outBytes, opts || {}).then(function(res){
          if(!res.ok){ failures.push("impor ulang gagal: " + res.message); return { ok: false, failures: failures }; }
          var m2 = res.model;
          if(m2.blocks.length < blocks.length){ failures.push("blok hasil lebih sedikit dari asal"); return { ok: false, failures: failures }; }
          for(var i = 0; i < blocks.length; i++){
            var expected = diFaithfulExpectedText(diBlockText(blocks[i]), inc.marksByBlock[i] || []);
            if(diBlockText(m2.blocks[i]) !== expected) failures.push("teks blok " + i + " tidak sesuai harapan");
          }
          var tail = m2.blocks.slice(blocks.length).map(function(b){ return diBlockText(b); }).join("\n");
          var app = diFaithfulAppendix(A);
          if(tail.indexOf(app.heading) < 0) failures.push("bagian rekomendasi tidak ditemukan");
          app.items.concat(app.unanchoredItems).forEach(function(it){
            if(tail.indexOf(it.sentence) < 0) failures.push("kalimat rekomendasi hilang (no " + it.no + ")");
            if(it.manual){ if(tail.indexOf("Perlu ditinjau manual") < 0) failures.push("label tinjau manual hilang"); }
            else if(it.proposal && tail.indexOf(it.proposal) < 0) failures.push("usulan perbaikan hilang (no " + it.no + ")");
          });
          return { ok: failures.length === 0, failures: failures };
        });
      });
    }

    /* ---------- PDF: gerbang kejujuran + geometri cermin terverifikasi ----------
       Geometri dibangun dengan MENCERMINKAN diPdfPageLines /
       diPdfLineRuns / diPdfAppendRun / diPdfPagesToModel DI-CORE
       langkah demi langkah, sambil mencatat asal-usul setiap karakter
       (item pdf.js + indeks karakter di dalam item). Cermin hanya
       DIPERCAYA bila teks + halaman setiap bloknya persis sama dengan
       DocModel hasil impor; selisih apa pun -> gerbang menolak. */
    function diFaithfulPdfGarble(pagesData){
      var total = 0, bad = 0;
      (pagesData || []).forEach(function(pg){
        ((pg && pg.items) || []).forEach(function(it){
          if(!it || typeof it.str !== "string") return;
          for(var i = 0; i < it.str.length; i++){
            var cp = it.str.codePointAt(i);
            if(cp > 0xFFFF) i++;
            if(cp === 0x20 || cp === 0x09 || cp === 0x0A || cp === 0x0D) continue;
            total++;
            if((cp >= 0xE000 && cp <= 0xF8FF) || cp === 0xFFFD || cp < 0x20 || cp === 0x7F) bad++;
          }
        });
      });
      return { total: total, bad: bad, ratio: total ? bad / total : 0 };
    }
    /* Himpunan karakter yang benar-benar dapat dikodekan font standar
       Helvetica pdf-lib (WinAnsiEncoding): ASCII tercetak + Latin-1 +
       tanda baca WinAnsi. Halaman rekomendasi tambahan digambar dengan
       font itu, jadi seluruh teksnya wajib lolos gerbang ini. */
    var DI_FAITHFUL_WINANSI_EXTRA = { 0x20AC: 1, 0x201A: 1, 0x0192: 1, 0x201E: 1, 0x2026: 1,
      0x2020: 1, 0x2021: 1, 0x02C6: 1, 0x2030: 1, 0x0160: 1, 0x2039: 1, 0x0152: 1, 0x017D: 1,
      0x2018: 1, 0x2019: 1, 0x201C: 1, 0x201D: 1, 0x2022: 1, 0x2013: 1, 0x2014: 1, 0x02DC: 1,
      0x2122: 1, 0x0161: 1, 0x203A: 1, 0x0153: 1, 0x017E: 1, 0x0178: 1 };
    function diFaithfulWinAnsiSafeChar(cp){
      if(cp >= 0x20 && cp <= 0x7E) return true;
      if(cp >= 0xA0 && cp <= 0xFF) return true;
      return !!DI_FAITHFUL_WINANSI_EXTRA[cp];
    }
    function diFaithfulWinAnsiSafe(text){
      var s = String(text == null ? "" : text);
      for(var i = 0; i < s.length; i++){
        var cp = s.codePointAt(i);
        if(cp > 0xFFFF) i++;
        if(!diFaithfulWinAnsiSafeChar(cp)) return false;
      }
      return true;
    }
    function diFaithfulLineRuns(entries, pageNo){
      var runs = [], prev = null;
      entries.forEach(function(d){
        var it = d.it;
        var size = diPdfItemSize(it);
        var flags = diPdfFontFlags(it.fontName);
        var run = { text: String(it.str), chars: [] };
        if(it.fontName) run.fontName = String(it.fontName);
        run.fontSize = Math.round(size * 10) / 10;
        if(flags.bold) run.bold = true;
        if(flags.italic) run.italic = true;
        for(var ci = 0; ci < it.str.length; ci++){
          run.chars.push({ page: pageNo, item: d.idx, ci: ci,
            x: d.x, y: d.y, width: typeof it.width === "number" ? it.width : 0,
            len: it.str.length, fs: size });
        }
        var x = d.x, w = typeof it.width === "number" ? it.width : 0;
        if(prev){
          var gap = x - (prev.x + prev.width);
          var space = gap > 0.22 * size && !/\s$/.test(prev.run.text) && !/^\s/.test(run.text);
          if(diPdfSameRun(prev.run, run)){
            if(space){ prev.run.text += " "; prev.run.chars.push({ ins: true, page: pageNo }); }
            prev.run.text += run.text;
            prev.run.chars = prev.run.chars.concat(run.chars);
            prev.x = x; prev.width = w;
            return;
          }
          if(space){ run.text = " " + run.text; run.chars = [{ ins: true, page: pageNo }].concat(run.chars); }
        }
        runs.push(run);
        prev = { x: x, width: w, run: run };
      });
      return runs;
    }
    function diFaithfulPdfLines(items, pageNo){
      var deco = [];
      (items || []).forEach(function(it, i){
        if(!it || typeof it.str !== "string" || !it.str.length) return;
        deco.push({ it: it, idx: i, x: typeof it.x === "number" ? it.x : 0,
          y: typeof it.y === "number" ? it.y : 0, size: diPdfItemSize(it) });
      });
      deco.sort(function(a, b){ return (b.y - a.y) || (a.x - b.x) || (a.idx - b.idx); });
      var lines = [];
      deco.forEach(function(d){
        var line = lines[lines.length - 1];
        var tol = line ? Math.max(1.25, 0.45 * Math.min(d.size, line.size)) : 0;
        if(line && Math.abs(d.y - line.y) <= tol){
          line.items.push(d);
          if(d.size > line.size) line.size = d.size;
        } else {
          lines.push({ y: d.y, size: d.size, items: [d] });
        }
      });
      return lines.map(function(line){
        var sorted = line.items.slice().sort(function(a, b){ return (a.x - b.x) || (a.idx - b.idx); });
        return { y: line.y, height: line.size, runs: diFaithfulLineRuns(sorted, pageNo) };
      });
    }
    function diFaithfulAppendRun(runs, run, spaceBefore){
      if(!run || !run.text) return;
      var last = runs[runs.length - 1];
      if(last && spaceBefore && !/[\s\-]$/.test(last.text) && !/^\s/.test(run.text)){
        if(diPdfSameRun(last, run)){
          last.text += " " + run.text;
          last.chars.push({ ins: true, page: run.chars.length ? run.chars[0].page : 0 });
          last.chars = last.chars.concat(run.chars);
          return;
        }
        runs.push({ text: " ", chars: [{ ins: true, page: run.chars.length ? run.chars[0].page : 0 }] });
        last = runs[runs.length - 1];
      }
      if(last && diPdfSameRun(last, run)){
        last.text += run.text;
        last.chars = last.chars.concat(run.chars);
        return;
      }
      var copy = { text: run.text, chars: run.chars.slice() };
      if(run.fontName) copy.fontName = run.fontName;
      if(typeof run.fontSize === "number") copy.fontSize = run.fontSize;
      if(run.bold) copy.bold = true;
      if(run.italic) copy.italic = true;
      runs.push(copy);
    }
    function diFaithfulPdfGeometry(pagesData){
      var blocks = [];
      (pagesData || []).forEach(function(pg, pi){
        var pageNo = (pg && typeof pg.page === "number") ? pg.page : pi + 1;
        var lines = diFaithfulPdfLines(pg ? pg.items : [], pageNo);
        var curRuns = null, lastY = 0, lastHeight = 0;
        function flush(){
          if(curRuns && curRuns.some(function(r){ return /\S/.test(r.text); })){
            var text = "", chars = [];
            curRuns.forEach(function(r){ text += r.text; chars = chars.concat(r.chars); });
            blocks.push({ page: pageNo, text: text, chars: chars });
          }
          curRuns = null;
        }
        lines.forEach(function(line){
          if(!line.runs.length) return;
          if(curRuns && (lastY - line.y) > 1.5 * lastHeight) flush();
          if(!curRuns) curRuns = [];
          line.runs.forEach(function(run, ri){
            diFaithfulAppendRun(curRuns, run, ri === 0 && curRuns.length > 0);
          });
          lastY = line.y; lastHeight = line.height;
        });
        flush();
      });
      return blocks;
    }
    /* Rect per fragmen item untuk rentang [start, end) pada blok
       geometri. Posisi-x di dalam item diinterpolasi proporsional
       terhadap lebar item dari pdf.js; y adalah garis dasar item
       (asal kiri-bawah, satuan poin PDF — ruang yang sama dengan
       pdf-lib). Karakter sisipan (spasi antar-item) menempel ke
       fragmen tetangganya; fragmen yang seluruhnya sisipan dilewati. */
    function diFaithfulRangeRects(gb, start, end){
      var groups = [], cur = null;
      for(var k = start; k < end; k++){
        var ch = gb.chars[k];
        if(!ch) continue;
        if(ch.ins){ if(cur) cur.chars.push(ch); continue; }
        if(cur && cur.item === ch.item && cur.page === ch.page) cur.chars.push(ch);
        else { cur = { item: ch.item, page: ch.page, chars: [ch] }; groups.push(cur); }
      }
      var rects = [];
      groups.forEach(function(g){
        var first = null, last = null;
        g.chars.forEach(function(c){ if(!c.ins){ if(!first) first = c; last = c; } });
        if(!first) return;
        var fs = first.fs || 12;
        var x0 = first.x + (first.ci / Math.max(1, first.len)) * first.width;
        var x1 = last.x + ((last.ci + 1) / Math.max(1, last.len)) * last.width;
        rects.push({ page: first.page, x: x0 - 0.6, y: first.y - 0.25 * fs,
          w: Math.max(1, (x1 - x0) + 1.2), h: 1.18 * fs, baseline: first.y, fs: fs });
      });
      return rects;
    }
    /* Rencana overlay lengkap. Urutan gerbang: data halaman -> teks
       rusak (CID/PUA) -> geometri cermin == model -> rotasi halaman
       -> karakter halaman rekomendasi. Kegagalan apa pun berarti
       TIDAK ADA overlay (pemanggil menawarkan PDF susun-ulang D8). */
    function diFaithfulPdfPlan(pagesData, model, A, pageDims){
      if(!pagesData || !pagesData.length) return { ok: false, reason: "no-pages" };
      var garble = diFaithfulPdfGarble(pagesData);
      if(garble.bad >= 3 && garble.ratio > 0.02) return { ok: false, reason: "garbled", garble: garble };
      var geo = diFaithfulPdfGeometry(pagesData);
      var blocks = (model && model.blocks) || [];
      if(geo.length !== blocks.length) return { ok: false, reason: "geometry-mismatch" };
      for(var i = 0; i < blocks.length; i++){
        if(geo[i].text !== diBlockText(blocks[i]) || geo[i].page !== blocks[i].page)
          return { ok: false, reason: "geometry-mismatch" };
      }
      var inc = diFaithfulIncluded(A);
      var rects = [], labels = [];
      var blockIdxs = Object.keys(inc.marksByBlock);
      for(var bi = 0; bi < blockIdxs.length; bi++){
        var gb = geo[+blockIdxs[bi]];
        if(!gb) return { ok: false, reason: "geometry-mismatch" };
        var dim = pageDims ? pageDims[gb.page] : null;
        if(!dim) return { ok: false, reason: "no-pages" };
        if(dim.rotation) return { ok: false, reason: "rotation" };
        var marks = inc.marksByBlock[blockIdxs[bi]];
        for(var mi = 0; mi < marks.length; mi++){
          var mk = marks[mi];
          var rs = diFaithfulRangeRects(gb, mk.start, mk.end);
          if(!rs.length) return { ok: false, reason: "geometry-mismatch" };
          rs.forEach(function(r){ r.no = mk.no; r.advisory = !!mk.advisory; rects.push(r); });
          labels.push({ page: rs[0].page, x: rs[0].x, y: rs[0].baseline + rs[0].fs * 1.05,
            no: mk.no, advisory: !!mk.advisory });
        }
      }
      var appendixLines = diFaithfulAppendixLines(A);
      for(var li = 0; li < appendixLines.length; li++){
        if(!diFaithfulWinAnsiSafe(appendixLines[li].text))
          return { ok: false, reason: "appendix-chars" };
      }
      return { ok: true, rects: rects, labels: labels, appendixLines: appendixLines, garble: garble };
    }
    /* FAITHFUL-CORE-END */
    /* ED-CORE-START — Editor kaya Asisten Menulis (D8 Tahap 4): fungsi
       MURNI serialisasi dua arah antara teks polos (tulang punggung
       #wi-input) dan pohon simpul editor (contenteditable). Blok ini
       tidak menyentuh DOM nyata: ia bekerja pada antarmuka simpul
       minimal (nodeType, tagName, childNodes, nodeValue) sehingga
       dapat diekstrak dan diuji di Node dengan pohon tiruan.
       KONTRAK SERIALISASI (beku; dibuktikan editor-test.cjs):
       1. Elemen blok (P, DIV, H1–H6, LI, BLOCKQUOTE, PRE, TD, TH)
          adalah satu unit paragraf; unit-unit digabung "\n\n".
       2. <br> di dalam unit berarti "\n" (baris baru intra-paragraf).
       3. Format sebaris (b, i, span, font, a, …) hanya menyumbang
          teksnya; atribut dan gaya tidak masuk teks tulang punggung.
       4. Item daftar (LI) adalah unit sendiri-sendiri; wadah (UL, OL,
          TABLE, SECTION, …) diteruskan ke anak-anaknya mengikuti
          urutan dokumen.
       5. Teks liar di tingkat akar (tidak dibungkus blok) membentuk
          unit sendiri hanya bila memuat karakter non-spasi.
       6. Penyesuaian artefak peramban (terukur pada Firefox):
          (a) <br> yang menjadi anak terakhir sebuah blok dibuang satu
          — itu br bantalan karet peramban (blok kosong <p><br></p>,
          dan <p>teks<br><br></p> sesudah Shift+Enter di akhir blok);
          (b) U+00A0 (nbsp yang disisipkan peramban di awal blok hasil
          belah paragraf) dinormalkan menjadi spasi biasa;
          (c) U+200B (penanda ketik span gaya editor) dibuang.
       7. wiEdSplitBlocks adalah invers persis serialisasi untuk teks
          polos: teks.split("\n\n"), lalu tiap unit .split("\n") —
          serialize(render(teks)) === teks untuk semua teks polos. */
    var WI_ED_BLOCK_TAGS = { P:1, DIV:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, LI:1, BLOCKQUOTE:1, PRE:1, TD:1, TH:1 };
    var WI_ED_CONTAINER_TAGS = { UL:1, OL:1, TABLE:1, THEAD:1, TBODY:1, TFOOT:1, TR:1, SECTION:1, ARTICLE:1, FIGURE:1, FIGCAPTION:1, MAIN:1, HEADER:1, FOOTER:1, FORM:1, FIELDSET:1 };
    function wiEdSplitBlocks(text){
      return String(text == null ? "" : text).split("\n\n").map(function(u){ return u.split("\n"); });
    }
    function wiEdIsBlock(node){
      return !!node && node.nodeType === 1 && !!(WI_ED_BLOCK_TAGS[node.tagName] || WI_ED_CONTAINER_TAGS[node.tagName]);
    }
    /* Jalani simpul-simpul sebaris, menambahkan teks ke array baris
       (baris terakhir adalah baris yang sedang diisi; <br> membuka
       baris baru). Elemen blok yang terselip di dalam sebaris
       diratakan: teksnya tetap dihitung, strukturnya tidak. */
    function wiEdWalkInline(nodes, lines){
      for(var i=0;i<nodes.length;i++){
        var k = nodes[i];
        if(!k) continue;
        if(k.nodeType === 3){ lines[lines.length-1] += (k.nodeValue || ""); }
        else if(k.nodeType === 1){
          if(k.tagName === "BR"){ lines.push(""); }
          else wiEdWalkInline(k.childNodes || [], lines);
        }
      }
      return lines;
    }
    function wiEdBlockUnits(block, units){
      var kids = block.childNodes || [];
      var hasBlockChild = false;
      for(var i=0;i<kids.length;i++){ if(wiEdIsBlock(kids[i])){ hasBlockChild = true; break; } }
      if(hasBlockChild){ wiEdCollectUnits(block, units); return; }
      var lines = wiEdWalkInline(kids, [""]);
      var last = kids[kids.length-1];
      if(last && last.nodeType === 1 && last.tagName === "BR" && lines.length > 1 && lines[lines.length-1] === "")
        lines.pop();
      units.push(lines.join("\n"));
    }
    function wiEdCollectUnits(node, units){
      var kids = node.childNodes || [];
      var stray = null;
      function flushStray(){
        if(stray){
          var t = stray.join("\n");
          if(/\S/.test(t)) units.push(t);
          stray = null;
        }
      }
      for(var i=0;i<kids.length;i++){
        var k = kids[i];
        if(wiEdIsBlock(k)){
          flushStray();
          if(WI_ED_CONTAINER_TAGS[k.tagName] && !WI_ED_BLOCK_TAGS[k.tagName]) wiEdCollectUnits(k, units);
          else wiEdBlockUnits(k, units);
        } else {
          if(!stray) stray = [""];
          wiEdWalkInline([k], stray);
        }
      }
      flushStray();
      return units;
    }
    function wiEdUnits(root){
      return wiEdCollectUnits(root, []);
    }
    function wiEdSerialize(root){
      return wiEdUnits(root).join("\n\n").replace(/\u00A0/g, " ").replace(/\u200B/g, "");
    }
    /* Varian LITERAL (D8 Tahap 5): unit digabung apa adanya, TANPA
       normalisasi U+00A0/U+200B. Dipakai permukaan selain Asisten
       Menulis (detektor, forensik, bandingkan, periksa cepat, OCR):
       jalur polos permukaan-permukaan itu tidak menormalkan kedua
       karakter tersebut, dan pembuangannya mengubah hasil analisis
       (U+200B yang dibuang menggabungkan dua kata menjadi satu —
       hitungan kata dan skor bergeser), sehingga hanya varian literal
       yang lulus gerbang ekuivalensi identik JSON penuh
       (editor-multi-test.cjs). Asisten Menulis tetap memakai
       wiEdSerialize persis seperti Tahap 4. */
    function wiEdSerializeLiteral(root){
      return wiEdUnits(root).join('\n\n');
    }
    /* Penyaring gaya tempel: hanya properti aman yang dipertahankan.
       kind "inline" untuk span/font; kind "block" untuk elemen blok. */
    var WI_ED_STYLE_INLINE = { "color":1, "background-color":1, "font-family":1, "font-size":1, "font-weight":1, "font-style":1, "text-decoration":1, "text-decoration-line":1, "vertical-align":1 };
    var WI_ED_STYLE_BLOCK = { "text-align":1, "line-height":1, "margin-left":1, "margin-top":1, "margin-bottom":1, "text-indent":1 };
    function wiEdFilterStyle(styleText, kind){
      var allow = kind === "block" ? WI_ED_STYLE_BLOCK : WI_ED_STYLE_INLINE;
      var out = [];
      String(styleText || "").split(";").forEach(function(decl){
        var idx = decl.indexOf(":");
        if(idx < 0) return;
        var prop = decl.slice(0, idx).trim().toLowerCase();
        var val = decl.slice(idx + 1).trim();
        if(!allow[prop] || !val) return;
        if(/url\s*\(|expression\s*\(|javascript:|[<>\\]|@import/i.test(val)) return;
        out.push(prop + ": " + val);
      });
      return out.join("; ");
    }
    /* Panjang CSS (px/pt/tanpa satuan) menjadi angka piksel. */
    function wiEdPxLen(v){
      var m = /^(-?[\d.]+)\s*(px|pt)?$/.exec(String(v == null ? "" : v).trim());
      if(!m) return 0;
      var n = parseFloat(m[1]);
      if(m[2] === "pt") n = n * 96 / 72;
      return n;
    }
    /* TB-ADD-START — Paket Toolbar (G1 Cari & Ganti, G2 Tautan): fungsi
       murni tambahan. Blok ini SENGAJA terpisah dan terdelimitasi:
       menghapus rentang TB-ADD-START..TB-ADD-END mengembalikan ekstrak
       ED-CORE ke keadaan basis byte-identik (dibuktikan uji T-TB-10).
       Tidak satu baris pun fungsi lama diubah oleh paket ini. */
    /* Daftar offset [awal, akhir) semua kecocokan jarum di dalam teks,
       tidak tumpang tindih, dari kiri ke kanan. Jarum kosong atau lebih
       panjang dari teks -> daftar kosong. caseSensitive=false (bawaan
       Cari & Ganti) membandingkan dalam huruf kecil. */
    function wiEdFindOffsets(text, needle, caseSensitive){
      var out = [];
      var t = String(text == null ? "" : text);
      var n = String(needle == null ? "" : needle);
      if(!n || n.length > t.length) return out;
      var hay = caseSensitive ? t : t.toLowerCase();
      var pin = caseSensitive ? n : n.toLowerCase();
      var pos = 0;
      for(;;){
        var i = hay.indexOf(pin, pos);
        if(i < 0) break;
        out.push([i, i + n.length]);
        pos = i + n.length;
      }
      return out;
    }
    /* Ganti semua kecocokan (semantik wiEdFindOffsets) dengan repl
       sebagai huruf biasa: pengulangan indexOf manual, sehingga "$&",
       "$'" dan sejenisnya pada teks pengganti TIDAK ditafsirkan
       sebagai pola khusus. Mengembalikan { text, count }; nol
       kecocokan mengembalikan string asal yang identik. */
    function wiEdReplaceAll(text, needle, repl, caseSensitive){
      var t = String(text == null ? "" : text);
      var n = String(needle == null ? "" : needle);
      var r = String(repl == null ? "" : repl);
      var offs = wiEdFindOffsets(t, n, caseSensitive);
      if(!offs.length) return { text: t, count: 0 };
      var parts = [], last = 0;
      offs.forEach(function(o){
        parts.push(t.slice(last, o[0]), r);
        last = o[1];
      });
      parts.push(t.slice(last));
      return { text: parts.join(""), count: offs.length };
    }
    /* Pemeriksa skema tautan untuk penyisipan editor: pola yang sama
       persis dengan pembersih tempelan — hanya http:, https:, dan
       mailto: yang lolos. Masukan dipangkas lebih dulu (kolom alamat
       memang dipangkas sebelum alamat disisipkan). */
    function wiEdLinkSchemeOk(url){
      return /^(https?:|mailto:)/i.test(String(url == null ? "" : url).trim());
    }
    /* TB-ADD-END */
    /* ED-CORE-END */

    /* Writing Intelligence — render & interaksi (DOM). */
    var WI_KIND_LABEL = { "repeated-word": "Kata berulang", "double-space": "Spasi tidak rapi", "missing-space-after-punctuation": "Spasi hilang setelah tanda baca", "sentence-capital": "Huruf awal kalimat", "kata-tidak-baku": "Kata tidak baku", "kata-depan": "Kata depan di/ke", "imbuhan": "Imbuhan di-/ke-", "tanda-baca": "Tanda baca", "huruf-kapital": "Huruf kapital", "kata-ulang": "Kata ulang", "pemisahan-kata": "Pemisahan kata", "ejaan-mekanis": "Ejaan", "kalimat-mubazir": "Kata mubazir", "kalimat-pengulangan-frasa": "Pengulangan frasa", "kalimat-kompleks": "Kalimat kompleks", "kalimat-panjang": "Kalimat panjang", "transisi-awalan": "Transisi antarkalimat" };
    var WI_CERT_LABEL = { "pasti": "Aturan pasti", "saran": "Saran", "potensial": "Masalah potensial", "gaya": "Saran gaya" };
    var wiTa = $("wi-input");
    var wiResult = null, wiAccepted = [], wiRejected = {};
    var wiReportHook = null; /* D5: diisi blok Document Intelligence — render Laporan Analisis setiap wiRender selesai. */
    var wiIgnored = [];
    function wiShowError(msg){
      var b = $("wi-error");
      if(msg){ b.textContent = msg; b.classList.add("show"); }
      else { b.textContent = ""; b.classList.remove("show"); }
    }
    function wiUpdateCount(){
      if(!wiTa) return;
      var n = wiTa.value.length, c = $("wi-count");
      c.textContent = fmtNumID(n) + " / 50.000 karakter";
      c.classList.toggle("over", n > WI_MAX_CHARS);
    }
    function wiJoin(paras, seps){
      var out = "";
      for(var i=0;i<paras.length;i++){ out += paras[i]; if(i < seps.length) out += seps[i]; }
      return out;
    }
    function wiParaHtml(t){
      if(!t) return "<em>(paragraf kosong)</em>";
      return escapeHtml(t).replace(/\n/g, "<br>");
    }
    // Khusus tampilan kartu saran: spasi dan baris baru dibuat terlihat
    // (␣ / ↵) agar saran tentang whitespace tidak tampak kosong.
    function wiShowWs(t){
      return escapeHtml(t).replace(/ /g, "␣").replace(/\n/g, "↵");
    }
    function wiRender(){
      if(!wiResult) return;
      var html = "", pending = 0, done = 0, rejected = 0, read = 0, pendingRep = 0;
      wiResult.suggestions.forEach(function(s){
        if(wiRejected[s.id]){ if(s.advisory) read++; else rejected++; return; }
        var isAcc = !s.advisory && wiAccepted.indexOf(s.id) >= 0;
        if(isAcc) done++; else { pending++; if(!s.advisory) pendingRep++; }
        html += "<div class=\"wi-card" + (isAcc ? " done" : "") + "\">"
          + "<div class=\"wi-card-head\"><span class=\"wi-kind\">" + (WI_KIND_LABEL[s.kind] || s.kind) + "</span>"
          + "<span class=\"wi-cert\">" + (WI_CERT_LABEL[s.certainty] || "Saran") + "</span>"
          + (isAcc ? "<span class=\"wi-state\">Diterima</span>" : "") + "</div>"
          + "<span class=\"wi-frag\">" + wiShowWs(s.original) + "</span>"
          + (s.advisory ? "" : "<div class=\"wi-arrow\">menjadi ↓</div>"
          + "<span class=\"wi-rep\">" + wiShowWs(s.replacement) + "</span>")
          + "<p class=\"wi-expl\">" + escapeHtml(s.explanation) + "</p>"
          + (isAcc ? "" : s.advisory
            ? "<div class=\"wi-actions\"><button type=\"button\" data-wi-reject=\"" + s.id + "\">Tandai sudah dibaca</button></div>"
            : "<div class=\"wi-actions\"><button type=\"button\" class=\"primary\" data-wi-accept=\"" + s.id + "\">Terima</button><button type=\"button\" data-wi-reject=\"" + s.id + "\">Tolak</button>" + (s.word ? "<button type=\"button\" data-wi-ignore=\"" + s.id + "\">Abaikan kata ini</button>" : "") + "</div>")
          + "</div>";
      });
      $("wi-sug-list").innerHTML = html;
      $("wi-sug-empty").innerHTML = wiResult.suggestions.length === 0
        ? "<div class=\"wi-empty\">Tidak ditemukan saran untuk teks ini. Pemeriksa ini bekerja dengan aturan dan daftar kata tertutup, jadi tidak semua kesalahan tertangkap — teks tetap perlu dibaca kembali secara manual.</div>" : "";
      $("wi-status").textContent = wiResult.suggestions.length === 0 ? "" :
        "Ditemukan " + wiResult.suggestions.length + " saran — " + done + " diterima, " + pending + " menunggu keputusan Anda" + (rejected ? ", " + rejected + " ditolak" : "") + (read ? ", " + read + " ditandai sudah dibaca" : "") + ".";
      var rev = wiApply(wiResult.paragraphs, wiResult.suggestions, wiAccepted);
      $("wi-revised").value = wiJoin(rev, wiResult.separators);
      var co = "", cr = "";
      wiResult.paragraphs.forEach(function(p, i){
        var changed = rev[i] !== p;
        co += "<p class=\"wi-para" + (changed ? " changed" : "") + "\">" + wiParaHtml(p) + "</p>";
        cr += "<p class=\"wi-para" + (changed ? " changed" : "") + "\">" + wiParaHtml(rev[i]) + "</p>";
      });
      $("wi-cmp-orig").innerHTML = co;
      $("wi-cmp-rev").innerHTML = cr;
      $("wi-undo").disabled = wiAccepted.length === 0;
      $("wi-accept-all").disabled = pendingRep === 0;
      $("wi-reset").disabled = wiAccepted.length === 0 && rejected === 0 && read === 0;
      if(wiReportHook) wiReportHook(); /* D5: Laporan Analisis mengikuti hasil & keputusan yang baru digambar. */
    }
    function wiRenderIgnored(){
      var box = $("wi-ignored");
      if(!box) return;
      if(!wiIgnored.length){ box.innerHTML = ""; return; }
      var html = "<span>Kata yang diabaikan sesi ini:</span>";
      wiIgnored.forEach(function(w){
        html += "<span class=\"wi-chip\">" + escapeHtml(w) + "<button type=\"button\" data-wi-unignore=\"" + escapeHtml(w) + "\" aria-label=\"Berhenti mengabaikan kata " + escapeHtml(w) + "\">×</button></span>";
      });
      box.innerHTML = html;
    }
    function wiRerun(){
      wiRenderIgnored();
      if(!wiResult) return;
      wiResult = wiAnalyze(wiTa.value, { ignoreWords: wiIgnored });
      wiAccepted = []; wiRejected = {};
      wiRender();
    }
    function wiRun(){
      var text = wiTa.value;
      wiShowError("");
      if(!text.trim()){ wiShowError("Tempel atau ketik teks terlebih dahulu, lalu tekan Analisis."); wiTa.focus(); return; }
      if(text.length > WI_MAX_CHARS){ wiShowError("Teks melebihi batas 50.000 karakter (" + fmtNumID(text.length) + " karakter). Persingkat teks atau bagi menjadi beberapa bagian, lalu coba lagi."); return; }
      var btn = $("wi-btn");
      btn.disabled = true;
      $("wi-busy").textContent = "Menganalisis…";
      setTimeout(function(){
        wiResult = wiAnalyze(text, { ignoreWords: wiIgnored });
        wiAccepted = []; wiRejected = {};
        $("wi-results").hidden = false;
        btn.disabled = false;
        $("wi-busy").textContent = "";
        wiRender();
      }, 30);
    }
    if(wiTa){
      wiTa.addEventListener("input", wiUpdateCount);
      $("wi-btn").addEventListener("click", wiRun);
      $("wi-clear").addEventListener("click", function(){
        wiTa.value = "";
        wiResult = null; wiAccepted = []; wiRejected = {};
        wiIgnored = []; wiRenderIgnored();
        wiUpdateCount();
        wiShowError("");
        $("wi-results").hidden = true;
        $("wi-read").hidden = true;
        $("wi-style").hidden = true;
        wiStyleText = null;
        wiTa.focus();
      });
      $("wi-sug-list").addEventListener("click", function(ev){
        var t = ev.target;
        var b = (t && t.closest) ? t.closest("[data-wi-accept],[data-wi-reject],[data-wi-ignore]") : null;
        if(!b) return;
        var a = b.getAttribute("data-wi-accept"), r = b.getAttribute("data-wi-reject"), ig = b.getAttribute("data-wi-ignore");
        if(a){ if(wiAccepted.indexOf(a) < 0 && !wiRejected[a]) wiAccepted.push(a); wiRender(); }
        else if(r){ wiRejected[r] = 1; wiRender(); }
        else if(ig && wiResult){
          var s = null;
          wiResult.suggestions.forEach(function(x){ if(x.id === ig) s = x; });
          if(s && s.word && wiIgnored.indexOf(s.word) < 0){ wiIgnored.push(s.word); wiRerun(); }
        }
      });
      $("wi-ignored").addEventListener("click", function(ev){
        var t = ev.target;
        var b = (t && t.closest) ? t.closest("[data-wi-unignore]") : null;
        if(!b) return;
        var w = b.getAttribute("data-wi-unignore");
        wiIgnored = wiIgnored.filter(function(x){ return x !== w; });
        wiRerun();
      });
      $("wi-accept-all").addEventListener("click", function(){
        if(!wiResult) return;
        wiResult.suggestions.forEach(function(s){ if(s.advisory) return; if(!wiRejected[s.id] && wiAccepted.indexOf(s.id) < 0) wiAccepted.push(s.id); });
        wiRender();
      });
      $("wi-undo").addEventListener("click", function(){ wiAccepted.pop(); wiRender(); });
      $("wi-reset").addEventListener("click", function(){ wiAccepted = []; wiRejected = {}; wiRender(); });
      $("wi-copy").addEventListener("click", function(){
        var ta = $("wi-revised"), st = $("wi-copy-status");
        function done(){ st.textContent = "Hasil revisi disalin."; }
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(ta.value).then(done, function(){ ta.select(); document.execCommand("copy"); done(); });
        } else { ta.select(); document.execCommand("copy"); done(); }
      });
      /* Phase 8.4 — Analisis Keterbacaan: hanya menampilkan statistik dari
         wiReadability; tidak pernah mengubah teks dan tidak menyimpan apa pun. */
      function wiReadBar(label, pct, valTxt){
        return "<div class=\"wi-read-bar-row\"><span>" + label + "</span><div class=\"wi-read-bar\"><div class=\"wi-read-fill\" style=\"width:" + pct + "%\"></div></div><span class=\"wi-read-val\">" + valTxt + "</span></div>";
      }
      function wiReadHtml(R){
        var c = R.components;
        var html = "<div class=\"wi-read-score\"><div class=\"wi-read-num\">" + R.score + "</div><div>"
          + "<div class=\"wi-read-band\">" + R.band + "</div>"
          + "<div class=\"wf-note\">Skor keterbacaan Saksara (0–100) — semakin tinggi, semakin ringan indikator statistiknya.</div></div></div>"
          + "<p class=\"wf-note\">Skor Saksara adalah estimasi dari indikator statistik di bawah ini — bukan standar ilmiah, bukan penilaian kualitas tulisan. Tulisan akademik wajar berada di rentang yang lebih menuntut.</p>";
        html += "<h4>Komponen skor</h4>";
        var rows = [
          ["Panjang kalimat rata-rata", c.sentence, "Rata-rata " + wfFmt(R.avgWordsPerSentence, 1) + " kata per kalimat. Nilai penuh pada rentang 12–22 kata; kalimat yang jauh lebih pendek atau jauh lebih panjang menurunkannya."],
          ["Keragaman panjang kalimat", c.variation, "Koefisien variasi panjang kalimat " + wfFmt(R.cvSentence, 2) + ". Nilai penuh pada rentang 0,35–0,75 — campuran kalimat pendek dan panjang membuat alur tidak monoton."],
          ["Kata panjang", c.longWords, "Sebesar " + wfFmt(R.longWordShare, 1) + "% kata tergolong panjang (perkiraan ≥ 4 suku kata). Makin besar proporsinya, makin rendah nilai komponen ini."],
          ["Kalimat sangat panjang", c.longSentences, "Sebesar " + wfFmt(R.longShare, 1) + "% kalimat berisi lebih dari 40 kata. Kalimat panjang tidak otomatis salah — komponen ini hanya menghitung proporsinya."],
          ["Panjang paragraf rata-rata", c.paragraph, "Rata-rata " + wfFmt(R.avgWordsPerParagraph, 1) + " kata per paragraf. Nilai penuh pada rentang 40–120 kata."]
        ];
        rows.forEach(function(r){
          html += wiReadBar(r[0], r[1], r[1] + " / 100") + "<p class=\"wi-read-expl\">" + r[2] + "</p>";
        });
        html += "<details class=\"wi-read-details\"><summary>Cara skor dihitung</summary>"
          + "<p>Skor adalah gabungan tertimbang lima komponen di atas (masing-masing 0–100): panjang kalimat rata-rata <strong>30%</strong>, keragaman panjang kalimat <strong>15%</strong>, kata panjang <strong>20%</strong>, kalimat sangat panjang <strong>20%</strong>, dan panjang paragraf rata-rata <strong>15%</strong>. Setiap komponen bernilai penuh pada rentang nyamannya dan menurun secara linear di luar rentang itu. Label hasilnya bersifat deskriptif — misalnya “Mudah diikuti” atau “Menuntut” — dan <strong>bukan</strong> label tingkat pendidikan pembaca.</p>"
          + "<ul>"
          + "<li><strong>Suku kata adalah perkiraan.</strong> Jumlah suku kata dihitung dari gugus huruf vokal, bukan dari kamus — kata serapan, nama diri, dan kata seperti “saat” dapat meleset.</li>"
          + "<li><strong>Pemisahan kalimat bersifat konservatif.</strong> Singkatan umum (dll., dkk., s.d., gelar), angka desimal, URL, dan sitasi dalam tanda kurung diusahakan tidak memotong kalimat, tetapi singkatan atau format yang tidak lazim tetap dapat memengaruhi hitungan.</li>"
          + "<li><strong>Hasil wajar berbeda antarjenis tulisan.</strong> Tulisan akademik dan hukum cenderung lebih menuntut daripada berita atau cerita — perbedaan itu normal, bukan masalah.</li>"
          + "<li><strong>Skor tidak mengukur isi.</strong> Kebenaran, tata bahasa, dan kualitas gagasan tidak dinilai oleh analisis ini.</li>"
          + "</ul></details>";
        html += "<h4>Distribusi panjang kalimat</h4>";
        function pctOf(n){ return R.sentences ? Math.round(1000 * n / R.sentences) / 10 : 0; }
        html += wiReadBar("Pendek (≤ 12 kata)", pctOf(R.buckets.pendek), fmtNumID(R.buckets.pendek) + " (" + wfFmt(pctOf(R.buckets.pendek), 1) + "%)");
        html += wiReadBar("Sedang (13–25 kata)", pctOf(R.buckets.sedang), fmtNumID(R.buckets.sedang) + " (" + wfFmt(pctOf(R.buckets.sedang), 1) + "%)");
        html += wiReadBar("Panjang (> 25 kata)", pctOf(R.buckets.panjang), fmtNumID(R.buckets.panjang) + " (" + wfFmt(pctOf(R.buckets.panjang), 1) + "%)");
        html += "<h4>Distribusi panjang paragraf</h4>";
        function pctP(n){ return R.paragraphs ? Math.round(1000 * n / R.paragraphs) / 10 : 0; }
        html += wiReadBar("≤ 25 kata", pctP(R.paraBuckets.le25), fmtNumID(R.paraBuckets.le25) + " paragraf");
        html += wiReadBar("26–75 kata", pctP(R.paraBuckets.le75), fmtNumID(R.paraBuckets.le75) + " paragraf");
        html += wiReadBar("76–150 kata", pctP(R.paraBuckets.le150), fmtNumID(R.paraBuckets.le150) + " paragraf");
        html += wiReadBar("> 150 kata", pctP(R.paraBuckets.gt150), fmtNumID(R.paraBuckets.gt150) + " paragraf");
        html += "<h4>Statistik dokumen</h4><dl class=\"wi-read-stats\">"
          + "<div><dt>Total kata</dt><dd>" + fmtNumID(R.words) + "</dd></div>"
          + "<div><dt>Jumlah kalimat</dt><dd>" + fmtNumID(R.sentences) + "</dd></div>"
          + "<div><dt>Jumlah paragraf</dt><dd>" + fmtNumID(R.paragraphs) + "</dd></div>"
          + "<div><dt>Rata-rata kata per kalimat</dt><dd>" + wfFmt(R.avgWordsPerSentence, 1) + "</dd></div>"
          + "<div><dt>Kalimat terpendek</dt><dd>" + R.minSentence + " kata</dd></div>"
          + "<div><dt>Kalimat terpanjang</dt><dd>" + R.maxSentence + " kata</dd></div>"
          + "<div><dt>Rata-rata kalimat per paragraf</dt><dd>" + wfFmt(R.avgSentencesPerParagraph, 1) + "</dd></div>"
          + "<div><dt>Rata-rata kata per paragraf</dt><dd>" + wfFmt(R.avgWordsPerParagraph, 1) + "</dd></div>"
          + "<div><dt>Rata-rata suku kata per kata (perkiraan)</dt><dd>" + wfFmt(R.avgSyllables, 2) + "</dd></div>"
          + "</dl>";
        html += "<h4>Bagian yang perlu diperhatikan</h4>";
        var att = [];
        R.denseParas.slice(0, 10).forEach(function(i){
          att.push("Paragraf ke-" + (i + 1) + " tergolong padat (" + fmtNumID(R.paraWords[i]) + " kata, " + R.paraSentences[i] + " kalimat) — pembaca mungkin terbantu jika paragraf ini dibagi menjadi dua atau lebih. Ini indikator statistik, bukan kesalahan.");
        });
        if(R.denseParas.length > 10) att.push("…dan " + (R.denseParas.length - 10) + " paragraf padat lainnya.");
        R.shortParas.slice(0, 10).forEach(function(i){
          att.push("Paragraf ke-" + (i + 1) + " sangat pendek (1 kalimat, " + R.paraWords[i] + " kata) — paragraf pendek bisa disengaja untuk penekanan; periksa saja apakah ia lebih baik digabung dengan paragraf di sekitarnya.");
        });
        if(R.shortParas.length > 10) att.push("…dan " + (R.shortParas.length - 10) + " paragraf sangat pendek lainnya.");
        if(R.longestSentenceWords > 40){
          var ex = R.longestSentenceText;
          if(ex.length > 160) ex = ex.slice(0, 160) + "…";
          att.push("Kalimat terpanjang berisi " + R.longestSentenceWords + " kata — pertimbangkan memeriksa apakah kalimat ini tetap jelas dalam sekali baca; kalimat panjang bisa saja sah dan perlu, terutama dalam tulisan akademik.<span class=\"wi-read-quote\">" + escapeHtml(ex) + "</span>");
        }
        html += att.length ? "<ul class=\"wi-read-att\"><li>" + att.join("</li><li>") + "</li></ul>"
          : "<p class=\"wf-note\">Tidak ada bagian yang menonjol perlu ditinjau dari indikator ini.</p>";
        return html;
      }
      $("wi-read-btn").addEventListener("click", function(){
        var text = wiTa.value;
        wiShowError("");
        if(text.length > WI_MAX_CHARS){ wiShowError("Teks melebihi batas 50.000 karakter (" + fmtNumID(text.length) + " karakter). Persingkat teks atau bagi menjadi beberapa bagian, lalu coba lagi."); return; }
        var R = wiReadability(text);
        var box = $("wi-read");
        box.hidden = false;
        box.innerHTML = R.empty
          ? "<div class=\"wi-empty\">Teks masih terlalu pendek untuk dianalisis keterbacaannya. Tulis atau tempel beberapa kalimat lengkap terlebih dahulu, lalu tekan Analisis keterbacaan lagi.</div>"
          : wiReadHtml(R);
      });
      /* Phase 8.5 — Kontrol Gaya Tulisan: menampilkan indikator dan temuan
         pola dari wiStyle; bersifat saran dan tidak pernah mengubah teks. */
      var WI_STYLE_DESC = {
        formal: "Acuan: bahasa baku dan sapaan resmi (saya/anda). Kata informal ditampilkan sebagai saran gaya, bukan kesalahan.",
        akademik: "Acuan: tulisan ilmiah — bahasa baku, sapaan saya/anda atau bentuk pasif, dan istilah yang konsisten.",
        profesional: "Acuan: komunikasi kerja yang jelas dan sopan — bahasa baku dengan nada profesional; kata informal ditampilkan sebagai saran gaya.",
        populer: "Acuan: tulisan untuk pembaca umum — bahasa lugas; frasa birokratis yang berbelit ditampilkan sebagai saran.",
        ringkas: "Acuan: hemat kata — pola kata berlebih yang terbukti dan kalimat sangat panjang ditampilkan sebagai saran.",
        naratif: "Acuan: cerita dan tuturan — pemeriksaan menekankan konsistensi sapaan dan istilah; profil ini tidak menambah temuan leksikal."
      };
      var WI_STYLE_KIND_LABEL = { "sapaan-orang-pertama": "Sapaan orang pertama", "sapaan-orang-kedua": "Sapaan orang kedua", "variasi-istilah": "Variasi istilah", "variasi-satuan": "Variasi satuan", "desimal-campuran": "Penulisan desimal", "pengulangan-frasa": "Pengulangan frasa", "kata-informal": "Kata informal", "sapaan-akademik": "Sapaan pada tulisan akademik", "frasa-birokratis": "Frasa birokratis", "kata-mubazir": "Kata berlebih", "kalimat-panjang-ringkas": "Kalimat panjang" };
      var wiStyleText = null;
      function wiStyleDescUpdate(){
        var sel = $("wi-style-profile");
        if(sel) $("wi-style-desc").textContent = WI_STYLE_DESC[sel.value] || "";
      }
      function wiStyleFindingHtml(f){
        return "<div class=\"wi-card\">"
          + "<div class=\"wi-card-head\"><span class=\"wi-kind\">" + (WI_STYLE_KIND_LABEL[f.kind] || f.kind) + "</span>"
          + "<span class=\"wi-cert\">" + (WI_CERT_LABEL[f.certainty] || "Saran gaya") + "</span>"
          + (f.scope === "profil" ? "<span class=\"wi-state\">Profil acuan: " + escapeHtml(WI_STYLE_PROFILE_LABEL[f.profile] || f.profile) + "</span>" : "")
          + "</div>"
          + "<span class=\"wi-frag\">" + escapeHtml(f.excerpt) + "</span>"
          + "<p class=\"wi-expl\">" + escapeHtml(f.reason) + "</p></div>";
      }
      function wiStyleHtml(S){
        var ind = S.indicators, html = "";
        function row(name, val, label, expl){
          return "<div class=\"wi-style-ind\"><div class=\"wi-style-ind-head\"><span class=\"wi-style-name\">" + name + "</span><span>" + val + "</span><span class=\"wi-style-label\">" + label + "</span></div><p class=\"wi-read-expl\">" + expl + "</p></div>";
        }
        html += "<h4>Karakteristik gaya</h4>";
        var f = ind.formality;
        html += row("Kecenderungan formalitas", fmtNumID(f.informalCount) + " kata informal (" + wfFmt(f.density, 1) + " per 100 kata)", f.label,
          "Dihitung dari penanda informal pada daftar kurasi (mis. nggak, banget, udah) di luar kutipan. Kata informal bukan kesalahan — angka ini hanya menggambarkan kecenderungan ragam bahasa.");
        html += row("Keringkasan kalimat", "Rata-rata " + wfFmt(ind.conciseness.avgWordsPerSentence, 1) + " kata per kalimat", ind.conciseness.label,
          "Rata-rata panjang kalimat yang sama dengan Analisis Keterbacaan. Kalimat panjang sah pada banyak jenis tulisan; ini sekadar deskripsi ukuran.");
        var vr = ind.vocabRepeat;
        var vrLabel = vr.topRepeated.length
          ? "Paling sering: " + vr.topRepeated.map(function(t){ return "“" + t.word + "” (" + t.count + " kali)"; }).join(", ")
          : "Tidak ada kata isi yang muncul 3 kali atau lebih";
        html += row("Pengulangan kosakata", "Rasio kata unik " + wfFmt(vr.ttr, 3) + " (" + fmtNumID(vr.unique) + " dari " + fmtNumID(vr.total) + " kata)", vrLabel,
          "Rasio type-token: makin rendah nilainya, makin banyak kata yang berulang. Pengulangan istilah baku dapat disengaja dan memang perlu — ini bukan penilaian.");
        html += row("Konsistensi istilah", fmtNumID(ind.termConsistency.variantGroups) + " kelompok istilah bervariasi", ind.termConsistency.label,
          "Kelompok istilah setara pada daftar kurasi (mis. email/surel, ponsel/handphone) yang dipakai dalam lebih dari satu variasi di dokumen ini.");
        html += row("Variasi kalimat", "Koefisien variasi " + wfFmt(ind.sentenceVariation.cv, 2), ind.sentenceVariation.label,
          "Sebaran panjang kalimat: nilai kecil berarti panjang kalimat seragam; nilai besar berarti campuran kalimat pendek dan panjang.");
        html += row("Kepadatan bahasa", "Rata-rata " + wfFmt(ind.density.avgSyllables, 2) + " suku kata per kata · " + wfFmt(ind.density.longWordShare, 1) + "% kata panjang", ind.density.label,
          "Berdasarkan perkiraan suku kata dari gugus vokal dan proporsi kata panjang (≥ 4 suku kata). Kosakata teknis memang cenderung lebih padat.");
        var doc = S.findings.filter(function(x){ return x.scope === "dokumen"; });
        var profF = S.findings.filter(function(x){ return x.scope === "profil"; });
        html += "<h4>Konsistensi dokumen</h4>";
        html += doc.length ? "<div class=\"wi-sug\">" + doc.map(wiStyleFindingHtml).join("") + "</div>"
          : "<p class=\"wf-note\">Tidak ada temuan konsistensi dari indikator ini.</p>";
        html += "<h4>Kesesuaian dengan profil " + escapeHtml(WI_STYLE_PROFILE_LABEL[S.profile] || S.profile) + "</h4>";
        html += profF.length ? "<div class=\"wi-sug\">" + profF.map(wiStyleFindingHtml).join("") + "</div>"
          : "<p class=\"wf-note\">Tidak ada temuan untuk profil ini dari indikator yang diperiksa.</p>";
        html += "<p class=\"wf-note\">Semua temuan di panel ini adalah hasil pencocokan pola terhadap daftar kurasi — bukan penilaian makna, maksud, atau kualitas tulisan. Keputusan akhir selalu di tangan penulis.</p>";
        return html;
      }
      function wiStyleRender(S){
        var box = $("wi-style");
        box.hidden = false;
        box.innerHTML = S.empty
          ? "<div class=\"wi-empty\">Teks belum memuat kata yang dapat dianalisis gayanya. Tulis atau tempel beberapa kalimat terlebih dahulu, lalu tekan Analisis gaya lagi.</div>"
          : wiStyleHtml(S);
      }
      $("wi-style-btn").addEventListener("click", function(){
        var text = wiTa.value;
        wiShowError("");
        if(!text.trim()){
          wiStyleText = null;
          var box = $("wi-style");
          box.hidden = false;
          box.innerHTML = "<div class=\"wi-empty\">Tempel atau ketik teks terlebih dahulu, pilih profil acuan, lalu tekan Analisis gaya.</div>";
          return;
        }
        if(text.length > WI_MAX_CHARS){ wiShowError("Teks melebihi batas 50.000 karakter (" + fmtNumID(text.length) + " karakter). Persingkat teks atau bagi menjadi beberapa bagian, lalu coba lagi."); return; }
        wiStyleText = text;
        wiStyleRender(wiStyle(text, $("wi-style-profile").value));
      });
      $("wi-style-profile").addEventListener("change", function(){
        wiStyleDescUpdate();
        // Profil adalah konteks pemeriksaan: mengganti profil menjalankan
        // ulang analisis yang sama pada teks terakhir yang dianalisis.
        if(wiStyleText !== null) wiStyleRender(wiStyle(wiStyleText, $("wi-style-profile").value));
      });
      wiStyleDescUpdate();
      wiUpdateCount();
      wiRenderIgnored();
    }

    /* ================= Document Intelligence (D1) =================
       Impor dokumen .docx ke Asisten Menulis. Blok inti dokumen membaca
       berkas menjadi DocModel; teks rakitannya ditempatkan di #wi-input
       dan dianalisis dengan alur yang sama persis seperti teks tempel.
       Model hanya hidup di variabel memori halaman ini — tidak disimpan
       di penyimpanan apa pun dan tidak dikirim ke mana pun. Menerapkan
       saran ke model (menjaga format) adalah tahap berikutnya; pada D1
       penerapan saran tetap berjalan pada teks seperti biasa. */
    (function(){
      var ta = $("wi-input");
      var fileIn = $("wi-doc-file");
      if(!ta || !fileIn) return;
      var card = $("wi-doc"), statusEl = $("wi-doc-status"), errEl = $("wi-doc-error"),
          coverEl = $("wi-doc-cover"), warnEl = $("wi-doc-warn"), actionsEl = $("wi-doc-actions");
      var wiDocState = null; /* { name, size, model, assembly, pdfStats } */
      function diFmtSize(n){
        if(typeof n !== "number" || isNaN(n)) return "";
        if(n < 1024) return n + " byte";
        if(n < 1048576) return (n / 1024).toFixed(1).replace(".", ",") + " KB";
        return (n / 1048576).toFixed(1).replace(".", ",") + " MB";
      }
      function diShowBanner(el, html){
        if(html){ el.innerHTML = html; el.classList.add("show"); }
        else { el.innerHTML = ""; el.classList.remove("show"); }
      }
      function diResetCard(){
        diFaithfulReset();
        wiDocState = null;
        statusEl.innerHTML = ""; statusEl.className = "file-status";
        diShowBanner(errEl, ""); diShowBanner(coverEl, ""); diShowBanner(warnEl, "");
        actionsEl.hidden = true;
        fileIn.value = "";
      }
      /* ================= Document Intelligence (D2): impor PDF =================
         Memakai pdf.js yang sama dengan route OCR lewat SATU pemuat
         bersama global (saksaraLoadPdfJs); tidak ada dependensi baru.
         Item teks pdf.js dinormalisasi menjadi data polos, lalu konversi
         ke DocModel dilakukan fungsi murni DI-CORE (diPdfPagesToModel). */
      function diLoadPdfJs(){
        /* Pemuat bersama global saksaraLoadPdfJs (D7-B) — didefinisikan
           di scope global di samping p6LoadScript agar route OCR (di
           luar IIFE ini) memakai jalur yang sama persis. */
        return saksaraLoadPdfJs();
      }
      function diImportPdf(bytes){
        return diLoadPdfJs().then(function(pdfjsLib){
          return pdfjsLib.getDocument({ data: bytes }).promise.then(function(doc){
            var pagesData = [];
            var chain = Promise.resolve();
            function collect(n){
              return doc.getPage(n).then(function(page){
                return page.getTextContent().then(function(tc){
                  var items = [];
                  (tc.items || []).forEach(function(it){
                    if(!it || typeof it.str !== "string" || !it.str.length) return;
                    var t = it.transform || [1, 0, 0, 1, 0, 0];
                    var fam = "";
                    if(tc.styles && it.fontName && tc.styles[it.fontName] && tc.styles[it.fontName].fontFamily)
                      fam = tc.styles[it.fontName].fontFamily;
                    items.push({ str: it.str, x: t[4], y: t[5],
                      width: typeof it.width === "number" ? it.width : 0,
                      fontName: fam || it.fontName || "",
                      fontSize: Math.abs(t[3]) || Math.abs(t[0]) || 0 });
                  });
                  pagesData.push({ page: n, items: items });
                    diFaithfulNotePdfPage(n, page);
                  if(typeof page.cleanup === "function") page.cleanup();
                });
              });
            }
            for(var n = 1; n <= doc.numPages; n++){
              (function(pn){ chain = chain.then(function(){ return collect(pn); }); })(n);
            }
            return chain.then(function(){
              if(typeof doc.destroy === "function") doc.destroy();
              var tstats = diPdfTextStats(pagesData);
              diFaithfulNotePdfPages(pagesData);
              if(tstats.scanLike) return { ok: false, code: "pdf-scan", pdfStats: tstats };
              var garble = diFaithfulPdfGarble(pagesData);
              if(garble.bad >= 3 && garble.ratio > 0.02) return { ok: false, code: "pdf-garbled", pdfStats: tstats, garble: garble };
              return { ok: true, model: diPdfPagesToModel(pagesData), pdfStats: tstats };
            });
          });
        }, function(loadErr){
          if(window.console && console.warn) console.warn("Saksara: pustaka PDF gagal dimuat", loadErr);
          return { ok: false, code: "pdf-load", message: "Pustaka pembaca PDF gagal dimuat — periksa koneksi internet, lalu coba lagi." };
        }).catch(function(err){
          if(window.console && console.warn) console.warn("Saksara: impor PDF gagal", err && err.name, err && err.message);
          var info = diPdfErrorInfo(err);
          return { ok: false, code: info.code, message: info.message };
        });
      }
      /* Bersihkan (alur reset yang sudah ada) juga membuang model dokumen. */
      $("wi-clear").addEventListener("click", diResetCard);
      $("wi-doc-remove").addEventListener("click", function(){
        diResetCard();
        $("wi-clear").click(); /* pakai jalur reset teks yang sudah ada */
      });
      function diHandleFile(f){
        diShowBanner(errEl, ""); diShowBanner(coverEl, ""); diShowBanner(warnEl, "");
        actionsEl.hidden = true;
        if(!f) return;
        if(typeof f.size === "number" && f.size > MAX_FILE_BYTES){
          statusEl.innerHTML = ""; statusEl.className = "file-status";
          diShowBanner(errEl, "Berkas terlalu besar — batasnya 20 MB.");
          return;
        }
        statusEl.className = "file-status show";
        statusEl.innerHTML = "Memproses <span class=\"fname\">" + escapeHtml(f.name) + "</span> (" + diFmtSize(f.size) + ")…";
        /* Beri kesempatan status tampil dulu (pola yang sama dengan wiRun),
           penguraian berjalan sesudahnya agar halaman tidak terasa terkunci. */
        setTimeout(function(){
          f.arrayBuffer().then(function(ab){
            var bytes = new Uint8Array(ab);
            diFaithfulCapture(f.name, bytes);
            /* Pilihan jalur berdasar ISI berkas (tanda tangan %PDF-), bukan ekstensi. */
            if(diSniffFormat(bytes) === "pdf") return diImportPdf(bytes);
            return diParseDocx(bytes);
          }).then(function(res){
            if(res && res.code === "pdf-scan"){
              /* PDF mirip pindaian: tidak ada lapisan teks yang terbaca.
                 Textarea TIDAK disentuh dan tidak ada model yang disimpan —
                 tampilkan peringatan jujur + arahkan ke halaman OCR. */
              var pst = res.pdfStats || { pages: 0, totalChars: 0 };
              statusEl.className = "file-status show";
              statusEl.innerHTML = "<span class=\"fname\">" + escapeHtml(f.name) + "</span> dimuat (" + fmtNumID(pst.pages) + " halaman), tetapi " +
                (pst.totalChars > 0
                  ? "hampir tidak ada teks yang dapat diekstrak darinya (hanya " + fmtNumID(pst.totalChars) + " karakter)."
                  : "tidak ada teks yang dapat diekstrak darinya.");
              diShowBanner(warnEl, "<strong>PDF ini tampaknya hasil pindaian (gambar), bukan dokumen teks.</strong> Asisten Menulis membaca lapisan teks PDF dan <strong>belum mendukung OCR</strong>, jadi berkas ini belum dapat dianalisis di sini. Untuk mengekstrak teks dari pindaian, gunakan <a href=\"#/ocr\">halaman OCR Saksara</a>, lalu tempel teks hasilnya ke kotak di bawah.");
              fileIn.value = "";
              return;
            }
            if(res && res.code === "pdf-garbled"){
              /* PDF berfont CID tanpa peta huruf: yang terbaca adalah kode
                 mentah (karakter kontrol), bukan huruf. Perlakuan sama
                 seperti cabang pindaian — textarea TIDAK disentuh dan
                 tidak ada model yang disimpan. */
              var gst = res.pdfStats || { pages: 0, totalChars: 0 };
              statusEl.className = "file-status show";
              statusEl.innerHTML = "<span class=\"fname\">" + escapeHtml(f.name) + "</span> dimuat (" + fmtNumID(gst.pages) + " halaman), tetapi teks di dalamnya tidak dapat dibaca — yang terbaca hanya kode mentah, bukan huruf.";
              diShowBanner(warnEl, "<strong>Teks PDF ini tidak terbaca.</strong> Font di dalam berkas ini tidak menyertakan peta huruf, sehingga teksnya terbaca sebagai kode mentah dan tidak dapat dianalisis dengan benar. Berkas seperti ini biasanya hasil konversi dari aplikasi lain. Coba simpan ulang PDF-nya dari aplikasi asalnya (misalnya Word atau Google Docs), atau gunakan <a href=\"#/ocr\">halaman OCR Saksara</a> untuk membaca tampilannya, lalu tempel teks hasilnya ke kotak di bawah.");
              fileIn.value = "";
              return;
            }
            if(!res.ok){
              statusEl.innerHTML = ""; statusEl.className = "file-status";
              diShowBanner(errEl, escapeHtml(res.message));
              fileIn.value = "";
              return;
            }
            var asm = diAssembleText(res.model);
            var stats = diModelStats(res.model);
            wiDocState = { name: f.name, size: f.size, model: res.model, assembly: asm, pdfStats: res.pdfStats || null };
            diInitWork(); /* D3: siapkan salinan kerja + pemetaan untuk dokumen ini */
            ta.value = asm.text;
            wiUpdateCount();
            var parts = [fmtNumID(stats.blocks) + " blok", fmtNumID(stats.words) + " kata"];
            if(typeof stats.pages === "number" && stats.pages > 0) parts.push(fmtNumID(stats.pages) + " halaman");
            if(stats.headings) parts.push(fmtNumID(stats.headings) + " judul");
            if(stats.tables) parts.push(fmtNumID(stats.tables) + " tabel");
            if(stats.protected) parts.push(fmtNumID(stats.protected) + " elemen terlindungi (rumus/kolom isian/gambar) — tidak ikut dianalisis");
            statusEl.className = "file-status show ok";
            statusEl.innerHTML = "<span class=\"fname\">" + escapeHtml(f.name) + "</span> berhasil dimuat — " + parts.join(" · ") + ". Teksnya sudah ada di kotak di bawah; tekan <strong>Analisis</strong> untuk memeriksanya.";
            actionsEl.hidden = false;
            if(asm.truncated){
              diShowBanner(coverEl, "Dokumen dipotong pada batas blok: " + fmtNumID(asm.keptBlocks) + " dari " + fmtNumID(asm.totalBlocks) + " blok teks pertama yang dimuat (batas 50.000 karakter per analisis). Blok selebihnya belum dianalisis.");
            }
            if(res.pdfStats && res.pdfStats.emptyPages > 0){
              diShowBanner(warnEl, fmtNumID(res.pdfStats.emptyPages) + " dari " + fmtNumID(res.pdfStats.pages) + " halaman PDF tidak menghasilkan teks (kemungkinan halaman gambar/pindaian) — halaman tersebut tidak ikut dianalisis.");
            }
            /* D4.1 (F7): pemberitahuan impor — hanya bila flag D4.1 pada
               model DOCX membuktikan salah satu kondisi terdeteksi saat
               penguraian (bagian header/footer, catatan kaki sungguhan,
               komentar, atau track changes). Model PDF tidak pernah
               membawa flag, jadi pemberitahuan ini tidak tampil untuk
               PDF — tidak ada klaim pemeriksaan yang tidak dijalankan. */
            if(res.model.format === "docx" && res.model.flags &&
              (res.model.flags.headerFooter || res.model.flags.footnotes || res.model.flags.comments || res.model.flags.trackedChanges)){
              diShowBanner(warnEl, "Header, footer, catatan kaki, dan komentar tidak ikut dimuat. Dokumen dengan track changes dimuat dalam tampilan perubahan yang diterima.");
            }
            if(!asm.text.replace(/\s+/g, "")){
              if(asm.truncated && asm.keptBlocks === 0 && asm.totalBlocks > 0){
                diShowBanner(errEl, "Blok teks pertama dokumen ini sendirian melebihi batas 50.000 karakter per analisis, jadi belum ada teks yang dapat dimuat dari dokumen ini. Pecah dokumen menjadi beberapa berkas yang lebih kecil, lalu muat dan analisis satu per satu.");
              } else {
                diShowBanner(errEl, "Dokumen tidak memuat teks yang dapat dianalisis — mungkin isinya hanya gambar, tabel kosong, atau rumus.");
              }
            }
          }).catch(function(){
            statusEl.innerHTML = ""; statusEl.className = "file-status";
            diShowBanner(errEl, "Berkas tidak dapat dibaca. Pastikan berkas adalah dokumen .docx yang utuh.");
            fileIn.value = "";
          });
        }, 30);
      }
      fileIn.addEventListener("change", function(){
        if(fileIn.files && fileIn.files[0]) diHandleFile(fileIn.files[0]);
      });
      if(card){
        card.addEventListener("dragover", function(ev){ ev.preventDefault(); card.classList.add("dragover"); });
        card.addEventListener("dragleave", function(){ card.classList.remove("dragover"); });
        card.addEventListener("drop", function(ev){
          ev.preventDefault();
          card.classList.remove("dragover");
          var files = ev.dataTransfer && ev.dataTransfer.files;
          if(files && files[0]) diHandleFile(files[0]);
        });
      }

      /* ================= Document Intelligence (D3): pemetaan saran & penerapan aman =================
         Saran WI dipetakan ke DocModel (fungsi murni DI-CORE diSyncModel /
         diMapSuggestion) dan — hanya bila statusnya "applicable" —
         diterapkan ke SALINAN KERJA model (diWork) lewat diApplyToModel.
         Model hasil impor tidak pernah diubah; teks biasa (Hasil Revisi)
         tetap dihitung WI seperti biasa dan tidak terpengaruh bagian ini.
         Tanpa dokumen yang dimuat, seluruh bagian ini tidak aktif dan
         perilaku #/tulis persis seperti sebelumnya.
         Kaitan ke alur WI yang sudah ada bersifat aditif: listener di
         bawah didaftarkan SESUDAH handler WI (yang terdaftar lebih dulu
         di berkas ini), sehingga handler WI selalu berjalan lebih dulu;
         lencana kartu digambar ulang oleh MutationObserver setiap kali
         wiRender membangun ulang daftar kartu. */
      var diWork = null;       /* salinan kerja model; null bila tidak ada dokumen */
      var diSnapshots = [];    /* snapshot model kerja sebelum tiap penerapan (sejajar diAppliedIds) */
      var diAppliedIds = [];   /* id saran yang sudah diterapkan ke dokumen kerja */
      var diMapping = null;    /* id saran -> hasil diMapSuggestion untuk wiResult berjalan */
      var diMappingFor = null; /* objek wiResult yang menjadi dasar diMapping */
      var diRefused = {};      /* id saran -> alasan penolakan pada saat penerapan */
      var diCountEl = $("wi-doc-count"), diNoteEl = $("wi-doc-note");

      function diUpdateDocCount(){
        if(!diCountEl) return;
        if(!wiDocState){ diCountEl.hidden = true; diCountEl.textContent = ""; return; }
        diCountEl.hidden = false;
        diCountEl.textContent = "Revisi diterapkan ke dokumen kerja: " + diAppliedIds.length;
      }
      function diInitWork(){
        diWork = wiDocState ? diCloneModel(wiDocState.model) : null;
        diSnapshots = []; diAppliedIds = []; diMapping = null; diMappingFor = null; diRefused = {};
        diShowBanner(diNoteEl, "");
        diUpdateDocCount();
      }
      function diComputeMapping(){
        diMappingFor = wiResult;
        diMapping = null;
        if(!wiDocState || !wiResult) return;
        if(diAppliedIds.length){
          /* wiRun/wiRerun selalu membuang keputusan teks (wiAccepted
             dikosongkan) — penerapan ke dokumen kerja ikut diatur ulang
             agar keadaan kedua sisi tidak pernah berbeda. */
          diWork = diCloneModel(wiDocState.model);
          diSnapshots = []; diAppliedIds = [];
          diShowBanner(diNoteEl, "Analisis dijalankan ulang — penerapan ke dokumen kerja diatur ulang mengikuti keputusan teks yang baru.");
          diUpdateDocCount();
        }
        diRefused = {};
        var sync = diSyncModel(wiDocState.model, wiResult.paragraphs);
        var mapped = diMapAll(wiDocState.model, sync, wiResult.suggestions);
        diMapping = {};
        wiResult.suggestions.forEach(function(s, i){ diMapping[s.id] = mapped[i]; });
      }
      function diEnsureMapping(){
        if(wiResult && diMappingFor !== wiResult) diComputeMapping();
      }
      function diRefusalText(reason){
        return reason === "ambiguous"
          ? "teks sasarannya muncul lebih dari sekali pada potongan teks yang sama, sehingga posisi pastinya tidak dapat ditentukan"
          : "teks sasarannya sudah berubah pada dokumen kerja";
      }
      function diBadgeFor(s){
        if(!s || s.advisory) return null;
        if(diRefused[s.id]) return { cls: "wi-doc-badge refused", text: "Penerapan ke dokumen ditolak — " + diRefused[s.id] + "." };
        var m = diMapping ? diMapping[s.id] : null;
        if(!m) return null;
        if(diAppliedIds.indexOf(s.id) >= 0) return { cls: "wi-doc-badge ok", text: "✓ Diterapkan ke dokumen kerja" };
        if(m.status === "applicable") return { cls: "wi-doc-badge ok", text: "✓ Dapat diterapkan ke dokumen kerja" };
        if(m.status === "readonly") return { cls: "wi-doc-badge", text: "Tidak diterapkan ke dokumen — " + m.reasonText + "." };
        return null;
      }
      /* Kartu saran di DOM berkorespondensi 1:1, seurutan, dengan saran
         yang TIDAK ditolak pada wiResult.suggestions (begitulah wiRender
         membangunnya). */
      function diCardFor(s){
        var list = $("wi-sug-list");
        if(!list || !wiResult) return null;
        var cards = list.querySelectorAll(".wi-card"), ci = 0, found = null;
        wiResult.suggestions.forEach(function(x){
          if(wiRejected[x.id]) return;
          if(x.id === s.id) found = cards[ci] || null;
          ci++;
        });
        return found;
      }
      function diPaintBadge(s, force){
        var card = diCardFor(s);
        if(!card) return;
        var old = card.querySelector(".wi-doc-badge");
        if(old && !force) return;
        var b = diBadgeFor(s);
        if(old) old.remove();
        if(!b) return;
        var div = document.createElement("div");
        div.className = b.cls;
        div.textContent = b.text;
        card.appendChild(div);
      }
      function diDecorateCards(){
        if(!wiDocState || !wiResult) return;
        diEnsureMapping();
        if(!diMapping) return;
        wiResult.suggestions.forEach(function(s){ diPaintBadge(s, false); });
      }
      function diTryApply(s){
        diEnsureMapping();
        var m = diMapping ? diMapping[s.id] : null;
        if(!m || m.status !== "applicable" || !diWork) return;
        var snap = diCloneModel(diWork);
        var r = diApplyToModel(diWork, m, s.replacement);
        if(r.ok){
          diSnapshots.push(snap);
          diAppliedIds.push(s.id);
          if(diRefused[s.id]) delete diRefused[s.id];
          diUpdateDocCount();
        } else {
          diRefused[s.id] = diRefusalText(r.reason);
        }
        diPaintBadge(s, true);
      }
      var diSugListEl = $("wi-sug-list");
      if(diSugListEl && typeof MutationObserver === "function"){
        /* Setiap wiRender membangun ulang innerHTML daftar kartu (lencana
           ikut terhapus) — observer menggambarnya kembali. Menggambar
           lencana idempoten: kartu yang sudah berlencana tidak berubah,
           jadi observer tidak berputar. */
        new MutationObserver(function(){ diDecorateCards(); }).observe(diSugListEl, { childList: true });
      }
      if(diSugListEl){
        diSugListEl.addEventListener("click", function(ev){
          if(!wiDocState || !wiResult) return;
          var t = ev.target;
          var b = (t && t.closest) ? t.closest("[data-wi-accept]") : null;
          if(!b) return;
          var id = b.getAttribute("data-wi-accept");
          if(wiAccepted.indexOf(id) < 0) return; /* handler WI berjalan lebih dulu */
          var s = null;
          wiResult.suggestions.forEach(function(x){ if(x.id === id) s = x; });
          if(s) diTryApply(s);
        });
      }
      /* Urungkan WI mem-pop id terakhir wiAccepted; id itu ditangkap pada
         fase capture (sebelum handler WI berjalan) lewat leluhur dokumen. */
      var diUndoId = null;
      document.addEventListener("click", function(ev){
        var t = ev.target;
        if(t && t.closest && t.closest("#wi-undo"))
          diUndoId = (typeof wiAccepted !== "undefined" && wiAccepted.length) ? wiAccepted[wiAccepted.length - 1] : null;
      }, true);
      $("wi-undo").addEventListener("click", function(){
        var id = diUndoId; diUndoId = null;
        if(!wiDocState || id == null) return;
        var i = diAppliedIds.lastIndexOf(id);
        if(i < 0) return; /* saran terakhir hanya berlaku pada teks */
        diWork = diSnapshots[i];
        diSnapshots.length = i;
        diAppliedIds.length = i;
        diUpdateDocCount();
      });
      $("wi-reset").addEventListener("click", function(){
        if(!wiDocState) return;
        diWork = diCloneModel(wiDocState.model);
        diSnapshots = []; diAppliedIds = []; diRefused = {};
        diUpdateDocCount();
      });
      $("wi-accept-all").addEventListener("click", function(){
        if(!wiDocState || !wiResult) return;
        diEnsureMapping();
        if(!diMapping || !diWork) return;
        var applied = 0, refused = 0, textOnly = 0;
        wiResult.suggestions.forEach(function(s){
          if(s.advisory || wiRejected[s.id] || wiAccepted.indexOf(s.id) < 0) return;
          if(diAppliedIds.indexOf(s.id) >= 0) return;
          var m = diMapping[s.id];
          if(!m) return;
          if(m.status !== "applicable"){ textOnly++; return; }
          var snap = diCloneModel(diWork);
          var r = diApplyToModel(diWork, m, s.replacement);
          if(r.ok){ diSnapshots.push(snap); diAppliedIds.push(s.id); applied++; }
          else { diRefused[s.id] = diRefusalText(r.reason); refused++; }
        });
        diUpdateDocCount();
        if(applied || refused || textOnly){
          diShowBanner(diNoteEl, "Terima semua: " + applied + " saran diterapkan ke dokumen kerja" +
            (textOnly ? ", " + textOnly + " saran hanya berlaku pada teks" : "") +
            (refused ? ", " + refused + " saran ditolak saat penerapan karena teks sasarannya berubah atau ambigu" : "") + ".");
        }
        diDecorateCards();
      });
      $("wi-clear").addEventListener("click", function(){
        diWork = null; diSnapshots = []; diAppliedIds = []; diMapping = null; diMappingFor = null; diRefused = {};
        diShowBanner(diNoteEl, "");
        diUpdateDocCount();
      });

      /* ================= Document Intelligence (D4): salin kaya, ekspor DOCX, perbandingan =================
         Mengeluarkan SALINAN KERJA model (diWork) dari halaman:
         - "Salin dengan format": ClipboardItem text/html (diModelToHtml)
           + text/plain sekaligus; bila clipboard kaya tidak tersedia,
           jatuh ke penyalinan teks biasa dengan pemberitahuan.
         - "Unduh DOCX": berkas dibangun dari model kerja oleh pustaka
           docx 8.5.0 (UMD) yang dimuat malas dari jsDelivr — satu-satunya
           dependensi baru proyek ini, dan satu-satunya pengambilan
           jaringan di alur dokumen (isi dokumen tidak pernah dikirim).
           Peringatan diExportWarnings ditampilkan dulu; klik kedua
           ("Tetap unduh DOCX") barulah mengunduh. Keadaan konfirmasi
           diikat pada cap keadaan dokumen, jadi dokumen/keputusan baru
           selalu memicu peringatan lagi.
         - "Bandingkan": tampilan baca-saja diDiffModels (asli vs kerja).
         Tanpa dokumen, seluruh bagian ini tidak aktif seperti D1–D3. */
      var DI_DOCX_URL = "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";
      var diCopyBtn = $("wi-doc-copy"), diExpBtn = $("wi-doc-export"), diCmpBtn = $("wi-doc-compare"),
          diExpWarnEl = $("wi-doc-expwarn"), diDiffEl = $("wi-doc-diff");
      var diDocxPromise = null, diExportWarnedFor = null, diExportBusy = false;
      /* D4.1: jenis peringatan yang SEDANG tampil pada panel ekspor —
         jalur salin tidak mengulang jenis yang sudah terlihat di sana
         (anti-duplikasi lintas permukaan, per jenis). */
      var diExpWarnKinds = [];

      function diWorkEmpty(){
        if(!diWork || !diWork.blocks || !diWork.blocks.length) return true;
        for(var i = 0; i < diWork.blocks.length; i++){
          var runs = diWork.blocks[i].runs || [];
          for(var j = 0; j < runs.length; j++){
            if(runs[j].protected) return false;
            if(runs[j].text && runs[j].text.replace(/\s+/g, "")) return false;
          }
        }
        return true;
      }
      function diRefreshD4Controls(){
        var empty = diWorkEmpty();
        [diCopyBtn, diExpBtn, diCmpBtn].forEach(function(b){
          if(!b) return;
          b.disabled = empty;
          b.title = empty ? "Dokumen belum memuat isi yang dapat diproses." : "";
        });
      }
      function diHideDiff(){
        if(diDiffEl){ diDiffEl.hidden = true; diDiffEl.innerHTML = ""; }
        if(diCmpBtn) diCmpBtn.textContent = "Bandingkan";
      }
      function diResetD4(){
        diExportWarnedFor = null;
        diExpWarnKinds = [];
        if(diExpBtn) diExpBtn.textContent = "Unduh DOCX";
        diShowBanner(diExpWarnEl, "");
        diHideDiff();
        diRefreshD4Controls();
      }
      function diExportStamp(){
        if(!wiDocState || !diWork) return "";
        var st = diModelStats(diWork);
        return wiDocState.name + "|" + diAppliedIds.length + "|" + st.chars + "|" + st.protected + "|" + (diWork.blocks || []).length;
      }
      function diLoadDocx(){
        if(window.docx && window.docx.Packer) return Promise.resolve(window.docx);
        if(!diDocxPromise){
          diDocxPromise = p6LoadScript(DI_DOCX_URL).then(function(){
            if(!window.docx || !window.docx.Packer || !window.docx.Document)
              throw new Error("global docx tidak lengkap");
            return window.docx;
          });
        }
        return diDocxPromise;
      }
      /* ----- Pembangunan berkas DOCX dari model kerja ----- */
      function diDocxRunProps(r){
        var p = {};
        if(r.bold) p.bold = true;
        if(r.italic) p.italics = true;
        if(r.underline) p.underline = {};
        if(r.fontName) p.font = { name: r.fontName };
        if(typeof r.fontSize === "number" && r.fontSize > 0) p.size = Math.round(r.fontSize * 2);
        return p;
      }
      function diDocxRuns(dx, block){
        var out = [];
        (block.runs || []).forEach(function(r){
          if(r.protected){
            /* Objek tertanam tidak disertakan (dinyatakan pada peringatan);
               rumus/field menjadi run teks linear biasa. */
            if(r.kind === "object") return;
            if(r.text) out.push(new dx.TextRun({ text: r.text }));
            return;
          }
          var safe = r.link ? diLinkSafe(r.link) : null;
          String(r.text).split("\n").forEach(function(seg, i){
            var props = diDocxRunProps(r);
            props.text = seg;
            if(i > 0) props.break = 1;
            if(safe){ props.style = "Hyperlink"; props.underline = {}; }
            var tr = new dx.TextRun(props);
            out.push(safe ? new dx.ExternalHyperlink({ link: safe, children: [tr] }) : tr);
          });
        });
        return out;
      }
      function diDocxAlign(dx, block){
        var A = dx.AlignmentType;
        switch(block.align){
          case "center": return A.CENTER;
          case "right": case "end": return A.RIGHT;
          case "both": return A.JUSTIFY;
          case "distribute": return A.DISTRIBUTE;
          case "left": case "start": return A.LEFT;
          default: return undefined;
        }
      }
      function diDocxIndent(block){
        if(!block.indent) return undefined;
        var ind = {}, any = false;
        ["left", "right", "firstLine", "hanging"].forEach(function(k){
          if(typeof block.indent[k] === "number"){ ind[k] = block.indent[k]; any = true; }
        });
        return any ? ind : undefined;
      }
      function diDocxTable(dx, model, tIdx, byId){
        var table = (model.tables || [])[tIdx];
        if(!table) return null;
        var rows = (table.rows || []).map(function(row){
          var cells = (row.cells || []).map(function(cell){
            var opts = {};
            if(cell.gridSpan > 1) opts.columnSpan = cell.gridSpan;
            if(cell.vMerge === "restart") opts.verticalMerge = dx.VerticalMergeType.RESTART;
            else if(cell.vMerge === "continue") opts.verticalMerge = dx.VerticalMergeType.CONTINUE;
            var cbs = (cell.blockIds || []).map(function(id){ return byId[id]; }).filter(Boolean)
              .sort(function(x, y){ return (x.cellPara || 0) - (y.cellPara || 0); });
            opts.children = cbs.length
              ? cbs.map(function(b){ return new dx.Paragraph({ children: diDocxRuns(dx, b) }); })
              : [new dx.Paragraph("")];
            return new dx.TableCell(opts);
          });
          return new dx.TableRow({ children: cells });
        });
        return new dx.Table({ rows: rows });
      }
      function diBuildDocx(dx, model){
        var byId = {};
        (model.blocks || []).forEach(function(b){ byId[b.id] = b; });
        /* Satu referensi penomoran per numId asal (daftar bernomor yang
           terpisah tidak saling menyambung nomor) + satu untuk bullet. */
        var numRefs = {}, hasBullet = false;
        function numKey(b){ return b.numId == null ? "x" : String(b.numId).replace(/[^A-Za-z0-9_-]/g, ""); }
        (model.blocks || []).forEach(function(b){
          if(b.type !== "list-item") return;
          if(b.listKind === "number"){ var k = numKey(b); if(!numRefs[k]) numRefs[k] = "di-num-" + k; }
          else hasBullet = true;
        });
        function levels(format, text){
          var lv = [];
          for(var i = 0; i < 8; i++)
            lv.push({ level: i, format: format, text: text, alignment: dx.AlignmentType.LEFT,
              style: { paragraphFormat: { indent: { left: 360 * (i + 1), hanging: 260 } } } });
          return lv;
        }
        var config = [];
        Object.keys(numRefs).forEach(function(k){ config.push({ reference: numRefs[k], levels: levels("decimal", "%1.") }); });
        if(hasBullet) config.push({ reference: "di-bul", levels: levels("bullet", "•") });
        var children = [], emitted = {};
        (model.blocks || []).forEach(function(b){
          if(b.type === "table-cell"){
            if(!emitted[b.table]){
              emitted[b.table] = true;
              var t = diDocxTable(dx, model, b.table, byId);
              if(t) children.push(t);
            }
            return;
          }
          if(b.type === "heading"){
            var lv = Math.min(6, Math.max(1, b.level || 1));
            children.push(new dx.Paragraph({
              heading: dx.HeadingLevel["HEADING_" + lv],
              outlineLevel: lv - 1,
              alignment: diDocxAlign(dx, b), indent: diDocxIndent(b),
              children: diDocxRuns(dx, b)
            }));
            return;
          }
          if(b.type === "list-item"){
            children.push(new dx.Paragraph({
              numbering: { reference: b.listKind === "number" ? numRefs[numKey(b)] : "di-bul",
                level: Math.min(7, Math.max(0, b.level || 0)) },
              alignment: diDocxAlign(dx, b),
              children: diDocxRuns(dx, b)
            }));
            return;
          }
          children.push(new dx.Paragraph({
            alignment: diDocxAlign(dx, b), indent: diDocxIndent(b),
            children: diDocxRuns(dx, b)
          }));
        });
        var opts = { sections: [{ children: children }] };
        if(config.length) opts.numbering = { config: config };
        return new dx.Document(opts);
      }
      function diExportFileName(){
        var base = String((wiDocState && wiDocState.name) || "dokumen").replace(/\.[^.]+$/, "");
        base = base.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
        if(!base) base = "dokumen";
        return base + "-revisi.docx";
      }
      function diDoExport(){
        if(diExportBusy) return;
        diExportBusy = true;
        if(diExpBtn) diExpBtn.disabled = true;
        diLoadDocx().then(function(dx){
          return dx.Packer.toBlob(diBuildDocx(dx, diWork));
        }).then(function(blob){
          var name = diExportFileName();
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a); a.click();
          setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 400);
          diShowBanner(diNoteEl, "Dokumen kerja diunduh sebagai " + escapeHtml(name) + ".");
        }).catch(function(err){
          if(window.console && console.warn) console.warn("Saksara: ekspor DOCX gagal", err && err.message);
          diShowBanner(diNoteEl, "Ekspor DOCX gagal — pustaka pengekspor tidak dapat dimuat atau dokumen tidak dapat dibangun. Periksa koneksi internet, lalu coba lagi.");
        }).then(function(){
          diExportBusy = false;
          diRefreshD4Controls();
        });
      }
      if(diExpBtn) diExpBtn.addEventListener("click", function(){
        if(!wiDocState || !diWork || diWorkEmpty()) return;
        var warnings = diExportWarnings(diWork);
        var stamp = diExportStamp();
        if(warnings.length && diExportWarnedFor !== stamp){
          diExportWarnedFor = stamp;
          diExpWarnKinds = warnings.map(function(w){ return w.kind; });
          var html = "<strong>Sebelum mengunduh, perhatikan:</strong><ul style=\"margin:6px 0 0; padding-left:18px;\">";
          warnings.forEach(function(w){
            html += "<li>" + escapeHtml(w.message) + (w.kind === "pdf-source" ? "" : " (" + fmtNumID(w.count) + ")") + "</li>";
          });
          html += "</ul>";
          diShowBanner(diExpWarnEl, html);
          diExpBtn.textContent = "Tetap unduh DOCX";
          return;
        }
        diExportWarnedFor = null;
        diExpWarnKinds = [];
        diShowBanner(diExpWarnEl, "");
        diExpBtn.textContent = "Unduh DOCX";
        diDoExport();
      });
      /* ----- Salin dengan format (rich-text) + fallback teks biasa ----- */
      function diExecCopy(text){
        var tmp = document.createElement("textarea");
        tmp.value = text;
        tmp.style.position = "fixed"; tmp.style.opacity = "0";
        document.body.appendChild(tmp);
        tmp.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch(e){ ok = false; }
        tmp.remove();
        return ok;
      }
      function diFallbackCopy(plain){
        if(navigator.clipboard && navigator.clipboard.writeText)
          return navigator.clipboard.writeText(plain).then(function(){ return true; }, function(){ return diExecCopy(plain); });
        return Promise.resolve(diExecCopy(plain));
      }
      /* D4.1: jenis peringatan yang relevan untuk permukaan SALIN HTML.
         heading-style tidak termasuk (HTML tidak mengenal nama gaya —
         tidak ada degradasi di permukaan ini) dan pdf-source tidak
         termasuk (naskahnya spesifik berkas DOCX). clipboard-indent
         khusus salin: indentasi tidak dibawa HTML, tetapi dipertahankan
         DOCX — karena itu ia tidak masuk diExportWarnings. */
      var DI_COPY_WARN_KINDS = { "protected-omml": 1, "protected-field": 1, "protected-object": 1,
        "underline-style": 1, "nested-table": 1, "link-scheme": 1 };
      if(diCopyBtn) diCopyBtn.addEventListener("click", function(){
        if(!wiDocState || !diWork || diWorkEmpty()) return;
        var html = diModelToHtml(diWork), plain = diModelToPlainText(diWork);
        /* Peringatan salin dihitung dari model kerja saat klik; jenis
           yang sedang tampil di panel ekspor disaring keluar agar tidak
           muncul dua kali di kartu yang sama. */
        var copyWarn = diExportWarnings(diWork).filter(function(w){ return DI_COPY_WARN_KINDS[w.kind]; });
        var indentCount = diModelIndentCount(diWork);
        if(indentCount > 0) copyWarn.push({ kind: "clipboard-indent", count: indentCount,
          message: "Indentasi paragraf tidak ikut tersalin ke format HTML (indentasi tetap dipertahankan pada unduhan DOCX)." });
        copyWarn = copyWarn.filter(function(w){ return diExpWarnKinds.indexOf(w.kind) < 0; });
        var rich = null;
        if(navigator.clipboard && typeof navigator.clipboard.write === "function" && typeof window.ClipboardItem === "function"){
          try {
            rich = navigator.clipboard.write([new window.ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([plain], { type: "text/plain" })
            })]).then(function(){ return true; }, function(){ return false; });
          } catch(e){ rich = null; }
        }
        Promise.resolve(rich).then(function(okRich){
          if(okRich){
            var noteHtml = "Dokumen kerja disalin dengan format (judul, tebal/miring, daftar, tautan, dan tabel dipertahankan sebatas dukungan aplikasi tujuan) beserta teks biasa.";
            if(copyWarn.length){
              noteHtml += "<br><strong>Perhatikan untuk salinan ini:</strong><ul style=\"margin:6px 0 0; padding-left:18px;\">";
              copyWarn.forEach(function(w){
                noteHtml += "<li>" + escapeHtml(w.message) + " (" + fmtNumID(w.count) + ")</li>";
              });
              noteHtml += "</ul>";
            }
            diShowBanner(diNoteEl, noteHtml);
            return;
          }
          return diFallbackCopy(plain).then(function(okPlain){
            diShowBanner(diNoteEl, okPlain
              ? "Salinan dengan format tidak tersedia di peramban ini — teks biasa dokumen kerja disalin."
              : "Penyalinan gagal. Anda tetap dapat menyalin teks hasil revisi lewat tombol Salin hasil.");
          });
        });
      });
      /* ----- Perbandingan sebelum/sesudah (baca-saja) ----- */
      var DI_DIFF_TAG = { heading: "Judul", paragraph: "Paragraf", "list-item": "Daftar", "table-cell": "Sel tabel" };
      function diRenderDiff(){
        var diff = diDiffModels(wiDocState.model, diWork);
        var html = "<div class=\"wi-doc-diff-head\">Perbandingan dokumen asli ↔ dokumen kerja — " +
          fmtNumID(diff.changedCount) + " blok berubah dari " + fmtNumID(diff.entries.length) + " blok.</div>";
        if(!diff.changedCount){
          html += "<p class=\"wi-doc-hint\">Belum ada revisi — dokumen kerja sama dengan dokumen asli.</p>";
        } else {
          diff.entries.forEach(function(e){
            var tag = DI_DIFF_TAG[e.type] || "Blok";
            if(e.status === "unchanged"){
              var t = e.workText;
              if(t.length > 160) t = t.slice(0, 160) + "…";
              html += "<div class=\"di-diff-block same\"><span class=\"di-diff-tag\">" + tag + " · tetap</span>" + escapeHtml(t) + "</div>";
            } else if(e.status === "changed"){
              var seg = "";
              e.segments.forEach(function(s){
                if(s.t === "del") seg += "<del>" + escapeHtml(s.text) + "</del>";
                else if(s.t === "ins") seg += "<ins>" + escapeHtml(s.text) + "</ins>";
                else seg += escapeHtml(s.text);
              });
              html += "<div class=\"di-diff-block changed\"><span class=\"di-diff-tag\">" + tag + " · berubah</span>" + seg + "</div>";
            } else if(e.status === "added"){
              html += "<div class=\"di-diff-block changed\"><span class=\"di-diff-tag\">" + tag + " · baru</span><ins>" + escapeHtml(e.workText) + "</ins></div>";
            } else {
              html += "<div class=\"di-diff-block changed\"><span class=\"di-diff-tag\">" + tag + " · terhapus</span><del>" + escapeHtml(e.origText) + "</del></div>";
            }
          });
        }
        diDiffEl.innerHTML = html;
      }
      if(diCmpBtn) diCmpBtn.addEventListener("click", function(){
        if(!wiDocState || !diWork) return;
        if(diDiffEl.hidden){ diRenderDiff(); diDiffEl.hidden = false; diCmpBtn.textContent = "Tutup perbandingan"; }
        else diHideDiff();
      });
      /* Keadaan D4 selalu mengikuti siklus dokumen: impor baru / hapus /
         bersihkan mengatur ulang konfirmasi ekspor + perbandingan. */
      $("wi-clear").addEventListener("click", function(){ diResetD4(); });
      $("wi-undo").addEventListener("click", function(){ diHideDiff(); });
      $("wi-reset").addEventListener("click", function(){ diHideDiff(); });
      if(statusEl && typeof MutationObserver === "function")
        new MutationObserver(function(){ diResetD4(); }).observe(statusEl, { childList: true });
      diRefreshD4Controls();

      /* ================= Document Intelligence (D5): Laporan Analisis =================
         Panel #wi-report menampilkan ringkasan terstruktur dari hasil
         wiAnalyze yang SUDAH ada. Model laporan dibangun fungsi murni
         diBuildReport (blok REPORT-CORE, lapisan presentasi) dari
         wiResult + data polos: keputusan pengguna, keterbacaan yang
         di-cache per objek hasil, dan keadaan dokumen D3. Laporan adalah
         INDEKS di atas daftar kartu — kartu tidak pernah diurutkan
         ulang, dipindah, atau digambar ulang oleh bagian ini; alasan
         lengkap dan tombol Terima/Tolak tetap hanya ada di kartu.
         Render dipicu satu baris panggilan di akhir wiRender lewat
         wiReportHook. Seluruh teks pengguna/dokumen digambar lewat
         escapeHtml/wiShowWs. Tidak ada isi dokumen yang disimpan atau
         dikirim ke mana pun. */
      var diReportEl = $("wi-report"), diReportBody = $("wi-report-body"), diReportNote = $("wi-report-note");
      var diReportModel = null;      /* model laporan terakhir — sumber data navigasi lokasi */
      var diReportReadFor = null, diReportRead = null; /* cache wiReadability per objek wiResult */
      var DI_REPORT_STATE_TEXT = { accepted: "Diterima", pending: "Menunggu keputusan", rejected: "Ditolak", read: "Sudah dibaca" };
      /* Keadaan kelompok kategori yang sedang terbuka dipertahankan
         lintas render ulang (render mengikuti setiap keputusan, dan
         membuka kelompok adalah tindakan membaca, bukan keputusan). */
      var prevOpen = [];
      function diReportDocStatusText(item){
        var d = item.doc;
        if(!d || item.advisory) return "";
        if(d.refused) return "Penerapan ke dokumen ditolak — " + d.refused + ".";
        if(d.applied) return "Diterapkan ke dokumen kerja";
        if(d.status === "applicable") return "Dapat diterapkan ke dokumen kerja";
        if(d.status === "readonly") return "Tidak diterapkan ke dokumen — " + (d.reasonText || d.reason || "") + ".";
        return "";
      }
      function diRenderReport(){
        if(!diReportEl || !diReportBody) return;
        if(!wiResult){ diReportEl.hidden = true; diReportBody.innerHTML = ""; diReportModel = null; return; }
        if(diReportReadFor !== wiResult){
          diReportRead = wiReadability(wiJoin(wiResult.paragraphs, wiResult.separators));
          diReportReadFor = wiResult;
        }
        var ex = { acceptedIds: wiAccepted.slice(), rejectedIds: Object.keys(wiRejected), readability: null, doc: null };
        if(diReportRead && !diReportRead.empty){
          ex.readability = { score: diReportRead.score, band: diReportRead.band, words: diReportRead.words,
            sentences: diReportRead.sentences, paragraphs: diReportRead.paragraphs,
            avgWordsPerSentence: diReportRead.avgWordsPerSentence, longShare: diReportRead.longShare,
            denseParas: diReportRead.denseParas.length };
        }
        if(wiDocState){
          diEnsureMapping();
          /* D7-A: statistik PDF D2 (jumlah halaman + halaman kosong) yang
             dipertahankan di wiDocState sejak impor diserahkan ke model
             laporan lewat saluran extras.doc.stats yang sudah ada —
             angka yang sama persis dengan banner impor. */
          var repStats = diModelStats(wiDocState.model);
          if(wiDocState.pdfStats){
            repStats.pdfEmptyPages = wiDocState.pdfStats.emptyPages;
            repStats.pdfTotalPages = wiDocState.pdfStats.pages;
          }
          ex.doc = { name: wiDocState.name, stats: repStats,
            assembly: { truncated: !!wiDocState.assembly.truncated, keptBlocks: wiDocState.assembly.keptBlocks, totalBlocks: wiDocState.assembly.totalBlocks },
            mapping: diMapping, appliedIds: diAppliedIds.slice(), refused: diRefused };
        }
        var R = diBuildReport(wiResult, ex);
        diReportModel = R;
        diReportNote.textContent = "";
        prevOpen = [];
        diReportBody.querySelectorAll(".wi-rep-details").forEach(function(d){ prevOpen.push(d.open); });
        var h = "";
        /* A — Ringkasan dokumen */
        h += "<div class=\"wi-rep-sec\"><h4>Ringkasan dokumen</h4><div class=\"wi-read-stats\">";
        if(R.coverage.mode === "doc") h += "<div><dt>Dokumen</dt><dd>" + escapeHtml(R.coverage.docName || "") + "</dd></div>";
        h += "<div><dt>Total temuan</dt><dd>" + fmtNumID(R.total) + "</dd></div>";
        h += "<div><dt>Paragraf dianalisis</dt><dd>" + fmtNumID(R.coverage.paragraphs) + "</dd></div>";
        h += "<div><dt>Karakter dianalisis</dt><dd>" + fmtNumID(R.coverage.analyzedChars) + "</dd></div>";
        if(R.coverage.mode === "doc" && R.coverage.docStats){
          var st = R.coverage.docStats;
          h += "<div><dt>Blok dokumen</dt><dd>" + fmtNumID(st.blocks) + "</dd></div>";
          h += "<div><dt>Kata pada dokumen</dt><dd>" + fmtNumID(st.words) + "</dd></div>";
          if(st.headings) h += "<div><dt>Judul</dt><dd>" + fmtNumID(st.headings) + "</dd></div>";
          if(st.tables) h += "<div><dt>Tabel</dt><dd>" + fmtNumID(st.tables) + "</dd></div>";
          if(typeof st.pages === "number" && st.pages > 0) h += "<div><dt>Halaman</dt><dd>" + fmtNumID(st.pages) + "</dd></div>";
          if(typeof st.pdfEmptyPages === "number" && typeof st.pdfTotalPages === "number") h += "<div><dt>Halaman PDF tanpa teks</dt><dd>" + fmtNumID(st.pdfEmptyPages) + " dari " + fmtNumID(st.pdfTotalPages) + "</dd></div>";
          h += "<div><dt>Diterapkan ke dokumen kerja</dt><dd>" + fmtNumID(R.coverage.appliedToDoc) + "</dd></div>";
        }
        h += "</div>";
        h += "<p class=\"wf-note\">Berdasarkan tingkat kepastian: " + R.byCertainty.map(function(c){ return (WI_CERT_LABEL[c.key] || c.key) + " " + fmtNumID(c.count); }).join(" · ") + ".</p>";
        var dec = [fmtNumID(R.decisions.accepted) + " diterima", fmtNumID(R.decisions.pending) + " menunggu keputusan"];
        if(R.decisions.rejected) dec.push(fmtNumID(R.decisions.rejected) + " ditolak");
        if(R.decisions.read) dec.push(fmtNumID(R.decisions.read) + " ditandai sudah dibaca");
        h += "<p class=\"wf-note\">Keputusan Anda sejauh ini: " + dec.join(", ") + ".</p>";
        if(R.coverage.docTruncated) h += "<p class=\"wf-note\">Cakupan: dokumen dipotong pada batas blok — " + fmtNumID(R.coverage.keptBlocks) + " dari " + fmtNumID(R.coverage.totalBlocks) + " blok teks pertama yang dianalisis; blok selebihnya belum dianalisis.</p>";
        if(R.coverage.analysisTruncated) h += "<p class=\"wf-note\">Cakupan: analisis internal terpotong pada batas 50.000 karakter.</p>";
        if(R.coverage.mode === "doc" && R.coverage.docStats && R.coverage.docStats.protected > 0)
          h += "<p class=\"wf-note\">Sebanyak " + fmtNumID(R.coverage.docStats.protected) + " elemen terlindungi (rumus, kolom isian, gambar) tidak ikut dianalisis.</p>";
        h += "</div>";
        /* B — Ringkasan kualitas: skor keterbacaan yang sudah ada, apa adanya */
        if(R.readability){
          var rd = R.readability;
          h += "<div class=\"wi-rep-sec\"><h4>Ringkasan kualitas — keterbacaan</h4>"
            + "<div class=\"wi-read-score\"><div class=\"wi-read-num\">" + rd.score + "</div><div><div class=\"wi-read-band\">" + escapeHtml(rd.band) + "</div>"
            + "<div class=\"wi-read-expl\">Indikator keterbacaan internal Saksara untuk teks yang dianalisis.</div></div></div>"
            + "<div class=\"wi-read-stats\">"
            + "<div><dt>Rata-rata kata per kalimat</dt><dd>" + String(rd.avgWordsPerSentence).replace(".", ",") + "</dd></div>"
            + "<div><dt>Kalimat &gt; 40 kata</dt><dd>" + String(rd.longShare).replace(".", ",") + "%</dd></div>"
            + "<div><dt>Paragraf padat</dt><dd>" + fmtNumID(rd.denseParas) + "</dd></div>"
            + "<div><dt>Kalimat</dt><dd>" + fmtNumID(rd.sentences) + "</dd></div>"
            + "</div>"
            + "<p class=\"wf-note\">Skor ini adalah indikator statistik internal/heuristik — <strong>bukan penilaian akademik, bukan penilaian ilmiah tervalidasi, dan bukan ukuran mutlak kualitas tulisan</strong>. Rincian lengkapnya ada di panel Analisis Keterbacaan.</p></div>";
        }
        /* C — Indeks temuan per kategori (ringkasan navigasi di atas kartu) */
        h += "<div class=\"wi-rep-sec\"><h4>Indeks temuan berdasarkan kategori</h4>";
        if(R.total === 0) h += "<div class=\"wi-empty\">Tidak ditemukan saran untuk teks ini.</div>";
        R.categories.forEach(function(cat, ci){
          var sub = R.byCertainty.map(function(c){ return { label: WI_CERT_LABEL[c.key] || c.key, n: cat.byCertainty[c.key] || 0 }; })
            .filter(function(x){ return x.n > 0; })
            .map(function(x){ return x.label + " " + fmtNumID(x.n); }).join(" · ");
          h += "<details class=\"wi-rep-details\"" + (prevOpen[ci] ? " open" : "") + "><summary>" + escapeHtml(cat.name) + " — " + fmtNumID(cat.count) + " temuan" + (sub ? " (" + sub + ")" : "") + "</summary>";
          cat.items.forEach(function(item){
            var docTxt = diReportDocStatusText(item);
            h += "<div class=\"wi-rep-row\">"
              + "<span class=\"wi-kind\">" + escapeHtml(WI_KIND_LABEL[item.kind] || item.kind) + "</span>"
              + "<span class=\"wi-cert\">" + escapeHtml(WI_CERT_LABEL[item.certainty] || item.certainty) + "</span>"
              + "<span class=\"wi-rep-loc\">Paragraf ke-" + fmtNumID(item.paragraph) + "</span>"
              + "<span class=\"wi-rep-state\">" + (DI_REPORT_STATE_TEXT[item.state] || item.state) + "</span>"
              + (item.advisory ? "<span class=\"wi-rep-loc\">Saran penasihat — tidak mengubah teks</span>" : "")
              + (docTxt ? "<span class=\"wi-rep-loc\">" + escapeHtml(docTxt) + "</span>" : "")
              + "<button type=\"button\" class=\"wi-rep-locate\" data-wi-locate=\"" + item.id + "\">Lihat lokasi</button>"
              + "<span class=\"wi-rep-quote\">" + wiShowWs(item.original) + "</span>"
              + "</div>";
          });
          h += "</details>";
        });
        h += "<p class=\"wf-note\">Indeks ini hanya ringkasan navigasi — alasan lengkap dan tombol Terima/Tolak tetap ada pada kartu saran di bawah, dalam urutan dokumen yang sama.</p></div>";
        /* E — Rekomendasi turunan hitungan + keterbatasan */
        h += "<div class=\"wi-rep-sec\"><h4>Rekomendasi</h4><ul class=\"wi-rep-list\">";
        R.recommendations.forEach(function(r){ h += "<li>" + escapeHtml(r) + "</li>"; });
        h += "</ul><h4>Keterbatasan analisis</h4><ul class=\"wi-rep-list\">";
        R.limitations.forEach(function(r){ h += "<li>" + escapeHtml(r) + "</li>"; });
        h += "</ul></div>";
        diReportBody.innerHTML = h;
        diReportEl.hidden = false;
      }
      /* Navigasi lokasi: jujur atau tidak sama sekali. Offset global dari
         model laporan hanya dipakai bila isi textarea saat klik PERSIS
         sama dengan teks yang dianalisis; bila teks sudah berubah,
         navigasi ditolak dengan pemberitahuan — tidak ada navigasi semu,
         dan teks pengguna tidak pernah diubah oleh bagian ini. */
      function diLocateFinding(id){
        if(!wiResult || !diReportModel) return;
        var item = null;
        diReportModel.categories.forEach(function(cat){ cat.items.forEach(function(it){ if(it.id === id) item = it; }); });
        if(!item) return;
        if(ta.value !== wiJoin(wiResult.paragraphs, wiResult.separators)){
          diReportNote.textContent = "Teks telah berubah sejak analisis terakhir — lokasi temuan tidak lagi dijamin tepat. Jalankan Analisis ulang agar lokasi temuan akurat.";
          return;
        }
        diReportNote.textContent = "";
        ta.focus();
        try { ta.setSelectionRange(item.globalStart, item.globalEnd); } catch(e) {}
        if(typeof ta.scrollIntoView === "function") ta.scrollIntoView({ block: "center" });
        var s = null;
        wiResult.suggestions.forEach(function(x){ if(x.id === id) s = x; });
        var card = s ? diCardFor(s) : null;
        if(card){
          card.classList.add("flash");
          setTimeout(function(){ card.classList.remove("flash"); }, 2000);
        }
      }
      if(diReportEl){
        diReportEl.addEventListener("click", function(ev){
          var t = ev.target;
          var b = (t && t.closest) ? t.closest("[data-wi-locate]") : null;
          if(b) diLocateFinding(b.getAttribute("data-wi-locate"));
        });
      }
      wiReportHook = diRenderReport;
      /* Sinkronisasi keadaan dokumen D3: wiRender berjalan SEBELUM
         listener D3 pada klik yang sama, jadi penerapan ke dokumen
         kerja (yang mengubah diAppliedIds/diRefused sesudah render)
         tidak terlihat oleh render laporan pada klik itu. Dua sinyal
         DOM menutup celahnya: setiap mutasi diAppliedIds di D3 selalu
         diikuti diUpdateDocCount (penghitung #wi-doc-count berubah),
         dan setiap perubahan lencana — termasuk penolakan penerapan —
         mengubah subtree daftar kartu. Keduanya memicu render ulang
         laporan di sini. Pintu kejujuran yang sama dengan navigasi
         dipakai: render ulang hanya bila isi textarea masih persis
         teks yang dianalisis — impor dokumen baru mengganti isi
         textarea, jadi laporan lama tidak pernah dicampur dokumen
         baru. Render laporan sendiri tidak menyentuh kedua elemen
         yang diamati, jadi pengamat tidak berputar. */
      function diReportSyncFromDoc(){
        if(!wiResult || !wiDocState || !diReportModel) return;
        if(ta.value !== wiJoin(wiResult.paragraphs, wiResult.separators)) return;
        diRenderReport();
      }
      if(typeof MutationObserver === "function"){
        if(diCountEl) new MutationObserver(diReportSyncFromDoc).observe(diCountEl, { childList: true, characterData: true });
        if(diSugListEl) new MutationObserver(diReportSyncFromDoc).observe(diSugListEl, { childList: true, subtree: true });
      }

      /* ================= Document Intelligence (D6): Ekspor PDF Laporan Analisis =================
         Tombol "Ekspor PDF" pada panel #wi-report mencetak MODEL laporan
         yang sama persis dengan yang dirender panel (diReportModel) —
         tidak ada hitungan ulang: susunan blok dibangun fungsi murni
         diReportPdfLines (REPORT-CORE) dari model + label panel +
         penjelasan/saran yang digabungkan lewat id saran + teks status
         dokumen dari diReportDocStatusText yang sama dengan panel.
         Kutipan selalu original MENTAH (tidak pernah wiShowWs).
         Font: subset Noto Sans (fonts/, OFL 1.1) dimuat MALAS hanya
         saat ekspor dari origin yang sama — tidak ada isi dokumen yang
         dikirim ke mana pun; satu-satunya lalu lintas adalah GET aset
         statis (jsPDF dari CDN yang sudah ada + berkas font lokal).
         Pra-cek karakter SEBELUM PDF dibuat:
         - font termuat -> setiap karakter wajib ada di cakupan cmap
           subset yang terbangun (fonts/noto-sans-coverage.json); yang
           tidak didukung menghentikan ekspor dengan pesan yang menyebut
           karakternya — tidak ada PDF yang kehilangan isi diam-diam.
         - font GAGAL dimuat -> fallback Helvetica hanya bila tidak ada
           karakter yang akan DIHAPUS pdfSafe (penghapusan menempelkan
           kata/mengubah makna); ekspor fallback menyatakan pemakaian
           font cadangan di status dan di dalam PDF. Bila ada karakter
           terhapus, ekspor dihentikan dengan pesan jelas.
         Dokumen dibangun di atas p6PdfKit (dokumen + geometri yang
         sama); primitif baris lokal D6 diperlukan karena line() kit
         mengunci helvetica + pdfSafe (akan merusak teks font Unicode)
         dan kit tidak punya tabel/keep-with-next — kedua pembangun
         PDF lain tidak diubah sama sekali. */
      var diPdfBtn = $("wi-report-pdf"), diPdfStatusEl = $("wi-report-pdf-status");
      var DI_PDF_FONT_FAMILY = "SaksaraLaporan";
      var DI_PDF_FONT_URLS = { normal: "fonts/saksara-laporan-regular.ttf", bold: "fonts/saksara-laporan-bold.ttf" };
      var DI_PDF_FONT_VFS = { normal: "saksara-laporan-regular.ttf", bold: "saksara-laporan-bold.ttf" };
      var DI_PDF_COVERAGE_URL = "fonts/noto-sans-coverage.json";
      var DI_PDF_FALLBACK_NOTICE = "Catatan: font utama laporan (Noto Sans) gagal dimuat, jadi laporan ini dicetak dengan font cadangan (Helvetica). Beberapa karakter tipografis disederhanakan mengikuti font cadangan.";
      var DI_PDF_LH = 5.6, DI_PDF_TOP = 18, DI_PDF_BOTTOM = 278, DI_PDF_M = 16, DI_PDF_W = 210;
      var diPdfFontPromise = null;
      function diPdfSetStatus(msg){ if(diPdfStatusEl) diPdfStatusEl.textContent = msg || ""; }
      function diPdfB64(buf){
        var bytes = new Uint8Array(buf), bin = "", CH = 0x8000;
        for(var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return btoa(bin);
      }
      function diPdfFetchFont(url){
        return fetch(url).then(function(r){
          if(!r.ok) throw new Error("berkas font " + url + " gagal dimuat (HTTP " + r.status + ")");
          return r.arrayBuffer();
        });
      }
      function diLoadReportFonts(){
        if(diPdfFontPromise) return diPdfFontPromise;
        diPdfFontPromise = Promise.all([
          diPdfFetchFont(DI_PDF_FONT_URLS.normal),
          diPdfFetchFont(DI_PDF_FONT_URLS.bold),
          fetch(DI_PDF_COVERAGE_URL).then(function(r){
            if(!r.ok) throw new Error("data cakupan font gagal dimuat (HTTP " + r.status + ")");
            return r.json();
          })
        ]).then(function(res){
          return { normal: diPdfB64(res[0]), bold: diPdfB64(res[1]), coverage: (res[2] && res[2].coverage) || [] };
        });
        /* Kegagalan tidak dimemoisasi: ekspor berikutnya boleh mencoba lagi. */
        diPdfFontPromise.catch(function(){ diPdfFontPromise = null; });
        return diPdfFontPromise;
      }
      function diPdfUnsupportedText(list){
        var shown = list.slice(0, 8).map(function(u){ return "'" + u.ch + "' (" + u.cp + ")"; }).join(", ");
        if(list.length > 8) shown += ", dan " + (list.length - 8) + " karakter lainnya";
        return shown;
      }
      /* ----- primitif tata letak lokal D6 (di atas dokumen p6PdfKit) ----- */
      function diPdfPrep(R, size, bold){ R.doc.setFont(R.font, bold ? "bold" : "normal"); R.doc.setFontSize(size); R.doc.setTextColor(0); }
      function diPdfTxt(R, txt){ return R.safe ? pdfSafe(txt) : String(txt); }
      function diPdfWrap(R, txt, size, bold, width){ diPdfPrep(R, size, bold); return R.doc.splitTextToSize(diPdfTxt(R, txt), width); }
      function diPdfPageBreak(R){ R.doc.addPage(); R.kit.setY(DI_PDF_TOP); }
      function diPdfDrawParts(R, parts, x){
        parts.forEach(function(p){
          if(R.kit.getY() > DI_PDF_BOTTOM) diPdfPageBreak(R);
          R.doc.text(p, x, R.kit.getY());
          R.kit.setY(R.kit.getY() + DI_PDF_LH);
        });
      }
      function diPdfPara(R, txt, size, bold){ diPdfDrawParts(R, diPdfWrap(R, txt, size || 10.5, !!bold, DI_PDF_W - 2 * DI_PDF_M), DI_PDF_M); }
      function diPdfGap(R, h){ R.kit.setY(R.kit.getY() + (h || 3)); }
      function diPdfHeading(R, txt, size, gapBefore){
        var parts = diPdfWrap(R, txt, size, true, DI_PDF_W - 2 * DI_PDF_M);
        var need = parts.length * DI_PDF_LH + DI_PDF_LH + (gapBefore || 0);
        if(R.kit.getY() > DI_PDF_TOP + 0.1 && R.kit.getY() + need > DI_PDF_BOTTOM) diPdfPageBreak(R);
        else if(gapBefore) diPdfGap(R, gapBefore);
        diPdfPrep(R, size, true);
        diPdfDrawParts(R, parts, DI_PDF_M);
        diPdfGap(R, 1.2);
      }
      function diPdfKv(R, rows){
        rows.forEach(function(row){
          var lp = diPdfWrap(R, row[0], 10.5, true, 54);
          var vp = diPdfWrap(R, row[1], 10.5, false, DI_PDF_W - DI_PDF_M - 72);
          var lines = Math.max(lp.length, vp.length);
          /* Baris yang muat satu halaman diusahakan utuh; baris yang
             lebih panjang dari satu halaman mengalir per baris —
             tidak ada baris nilai yang dibuang dalam keadaan apa pun. */
          if(R.kit.getY() + lines * DI_PDF_LH > DI_PDF_BOTTOM && lines * DI_PDF_LH <= DI_PDF_BOTTOM - DI_PDF_TOP) diPdfPageBreak(R);
          for(var i = 0; i < lines; i++){
            if(R.kit.getY() > DI_PDF_BOTTOM) diPdfPageBreak(R);
            var y = R.kit.getY();
            if(i < lp.length){ diPdfPrep(R, 10.5, true); R.doc.text(lp[i], DI_PDF_M, y); }
            if(i < vp.length){ diPdfPrep(R, 10.5, false); R.doc.text(vp[i], 72, y); }
            R.kit.setY(y + DI_PDF_LH);
          }
        });
      }
      function diPdfFinding(R, block){
        /* Bungkus dulu seluruh blok agar tingginya diketahui: blok yang
           muat satu halaman diusahakan tidak terbelah; blok yang lebih
           panjang dari satu halaman mengalir apa adanya. */
        var headParts = diPdfWrap(R, block.head, 10.5, true, DI_PDF_W - 2 * DI_PDF_M);
        var fields = block.fields.map(function(f){
          diPdfPrep(R, 10.5, true);
          var lw = R.doc.getTextWidth(diPdfTxt(R, f[0]) + "  ");
          if(lw > 60) lw = 60;
          return { label: f[0], lw: lw, parts: diPdfWrap(R, f[1], 10.5, false, DI_PDF_W - 2 * DI_PDF_M - lw) };
        });
        var totalLines = headParts.length;
        fields.forEach(function(f){ totalLines += Math.max(1, f.parts.length); });
        var height = totalLines * DI_PDF_LH + 2.5;
        if(R.kit.getY() + height > DI_PDF_BOTTOM && height <= DI_PDF_BOTTOM - DI_PDF_TOP) diPdfPageBreak(R);
        diPdfPrep(R, 10.5, true);
        diPdfDrawParts(R, headParts, DI_PDF_M);
        fields.forEach(function(f){
          if(R.kit.getY() > DI_PDF_BOTTOM) diPdfPageBreak(R);
          var y0 = R.kit.getY();
          diPdfPrep(R, 10.5, true);
          R.doc.text(diPdfTxt(R, f.label), DI_PDF_M, y0);
          diPdfPrep(R, 10.5, false);
          f.parts.forEach(function(p, i){
            var yy = y0 + i * DI_PDF_LH;
            if(yy > DI_PDF_BOTTOM){ diPdfPageBreak(R); yy = R.kit.getY(); y0 = yy - i * DI_PDF_LH; }
            R.doc.text(p, DI_PDF_M + f.lw, yy);
          });
          R.kit.setY(y0 + Math.max(1, f.parts.length) * DI_PDF_LH);
        });
        diPdfGap(R, 2.5);
      }
      function diPdfBullet(R, txt){
        var parts = diPdfWrap(R, txt, 10.5, false, DI_PDF_W - 2 * DI_PDF_M - 4);
        parts.forEach(function(p, i){
          if(R.kit.getY() > DI_PDF_BOTTOM) diPdfPageBreak(R);
          if(i === 0){ diPdfPrep(R, 10.5, false); R.doc.text(diPdfTxt(R, "•"), DI_PDF_M, R.kit.getY()); }
          R.doc.text(p, DI_PDF_M + 4, R.kit.getY());
          R.kit.setY(R.kit.getY() + DI_PDF_LH);
        });
      }
      function diPdfRender(R, blocks, opts){
        /* Kepala laporan (pola wordmark kit, dengan font aktif D6). */
        diPdfPrep(R, 16, true);
        R.doc.setTextColor(29, 95, 209);
        R.doc.text("Saksara", DI_PDF_M, R.kit.getY());
        R.doc.setTextColor(0);
        R.kit.setY(R.kit.getY() + 8);
        var coverDone = false;
        blocks.forEach(function(b){
          if(b.t === "title"){ diPdfPara(R, b.text, 13.5, true); }
          else if(b.t === "meta"){ diPdfPara(R, b.text, 9.5, false); }
          else if(b.t === "h"){
            if(!coverDone){
              coverDone = true;
              diPdfGap(R, 1);
              R.doc.setDrawColor(160);
              R.doc.line(DI_PDF_M, R.kit.getY(), DI_PDF_W - DI_PDF_M, R.kit.getY());
              diPdfGap(R, 5);
              if(opts.fallback){ diPdfPara(R, DI_PDF_FALLBACK_NOTICE, 10, false); diPdfGap(R, 2); }
            }
            diPdfHeading(R, b.text, 12, 4);
          }
          else if(b.t === "h2"){ diPdfHeading(R, b.text, 11, 3); }
          else if(b.t === "kv"){ diPdfKv(R, b.rows); diPdfGap(R, 2); }
          else if(b.t === "p"){ diPdfPara(R, b.text, 10.5, false); diPdfGap(R, 1); }
          else if(b.t === "li"){ diPdfBullet(R, b.text); }
          else if(b.t === "finding"){ diPdfFinding(R, b); }
        });
      }
      function diPdfStamp(R, dateStr){
        var n = R.doc.getNumberOfPages();
        var left = "Saksara · Laporan Analisis Tulisan · dibuat lokal di peramban ini · " + dateStr;
        for(var i = 1; i <= n; i++){
          R.doc.setPage(i);
          R.doc.setFont(R.font, "normal");
          R.doc.setFontSize(8);
          R.doc.setTextColor(120);
          R.doc.text(diPdfTxt(R, left), DI_PDF_M, 290);
          R.doc.text(diPdfTxt(R, "Halaman " + i + " dari " + n), DI_PDF_W - DI_PDF_M, 290, { align: "right" });
        }
        R.doc.setTextColor(0);
      }
      async function diExportReportPdf(){
        if(!diReportModel || !wiResult){
          diPdfSetStatus("Belum ada laporan — jalankan analisis terlebih dahulu, lalu ekspor PDF-nya.");
          return;
        }
        var details = {}, docStatus = {};
        wiResult.suggestions.forEach(function(s){
          details[s.id] = { explanation: s.explanation || "", replacement: typeof s.replacement === "string" ? s.replacement : null };
        });
        diReportModel.categories.forEach(function(cat){
          cat.items.forEach(function(it){
            var t = diReportDocStatusText(it);
            if(t) docStatus[it.id] = t;
          });
        });
        var dateStr = new Date().toLocaleString("id-ID");
        var blocks = diReportPdfLines(diReportModel, {
          kindLabels: WI_KIND_LABEL, certLabels: WI_CERT_LABEL, stateLabels: DI_REPORT_STATE_TEXT,
          details: details, docStatus: docStatus, dateStr: dateStr
        });
        var fileName = diReportPdfFileName(new Date());
        var texts = diReportPdfTexts(blocks).concat([
          "Saksara", "Saksara · Laporan Analisis Tulisan · dibuat lokal di peramban ini · " + dateStr,
          "Halaman 1 dari 1", DI_PDF_FALLBACK_NOTICE
        ]);
        diPdfBtn.disabled = true;
        diPdfSetStatus("Menyiapkan PDF…");
        try {
          var jsPDF = await loadJsPdf();
          var fonts = null;
          try { fonts = await diLoadReportFonts(); } catch(eFont) { fonts = null; }
          var useFont = !!fonts;
          if(useFont){
            var pf = diPdfPreflight(texts, fonts.coverage);
            if(!pf.ok){
              diPdfSetStatus("Ekspor dihentikan: karakter berikut tidak didukung font laporan, sehingga isi laporan tidak dapat dipertahankan persis: " + diPdfUnsupportedText(pf.unsupported) + ". PDF tidak dibuat agar tidak ada isi yang hilang diam-diam.");
              return;
            }
          } else {
            var deleted = diPdfHelveticaDeleted(texts);
            if(deleted.length){
              diPdfSetStatus("Ekspor dihentikan: font laporan (Noto Sans) gagal dimuat, dan karakter berikut akan hilang bila dicetak dengan font cadangan: " + diPdfUnsupportedText(deleted) + ". PDF tidak dibuat — periksa koneksi internet lalu coba lagi.");
              return;
            }
          }
          var kit = p6PdfKit(jsPDF, "Laporan Analisis Tulisan — Saksara");
          var doc = kit.doc;
          if(useFont){
            doc.addFileToVFS(DI_PDF_FONT_VFS.normal, fonts.normal);
            doc.addFont(DI_PDF_FONT_VFS.normal, DI_PDF_FONT_FAMILY, "normal");
            doc.addFileToVFS(DI_PDF_FONT_VFS.bold, fonts.bold);
            doc.addFont(DI_PDF_FONT_VFS.bold, DI_PDF_FONT_FAMILY, "bold");
          }
          var R = { doc: doc, kit: kit, font: useFont ? DI_PDF_FONT_FAMILY : "helvetica", safe: !useFont };
          diPdfRender(R, blocks, { fallback: !useFont });
          diPdfStamp(R, dateStr);
          doc.save(fileName);
          diPdfSetStatus(useFont
            ? "PDF dibuat: " + fileName + " — dicetak dengan font Noto Sans subset (karakter Unicode dipertahankan)."
            : "PDF dibuat dengan font cadangan (Helvetica) karena font utama gagal dimuat: " + fileName + " — beberapa karakter tipografis disederhanakan.");
        } catch(e){
          diPdfSetStatus("Ekspor PDF gagal: " + (e && e.message ? e.message : e));
        } finally {
          diPdfBtn.disabled = false;
        }
      }
      if(diPdfBtn) diPdfBtn.addEventListener("click", function(){ diExportReportPdf(); });

      /* ================= Document Intelligence (D8): Ekspor PDF Beranotasi =================
         Tombol "Ekspor PDF Beranotasi" pada panel #wi-report MELENGKAPI
         ekspor ringkasan D6 (keputusan D-2) — tidak menggantikannya.
         Sumber data: model beranotasi murni annotBuildReport
         (ANNOT-CORE) dari wiResult yang sama + keadaan dokumen D3 yang
         sama dengan panel; tata letak dihitung SATU KALI oleh mesin
         murni annotPdfLayout (ANNOT-PDF-CORE, syarat C-2) menjadi
         rencana operasi berkoordinat final, dan pelaksana di bawah
         hanya menggambar rencana itu — tidak ada pengukuran ulang,
         jadi rect penanda tidak dapat bergeser dari glifnya.
         Font subset yang sama dengan D6 (diLoadReportFonts, malas,
         same-origin); tidak ada isi dokumen yang dikirim ke mana pun.
         Kebijakan karakter D-1 (keputusan pemilik): dengan font subset
         termuat, karakter di luar cakupan TIDAK menghentikan ekspor —
         ia diganti penanda tercetak + pengungkapan (lihat model
         unsupported + annotPdfDisclosure). Bila font GAGAL dimuat,
         gerbang cadangan D6 berlaku apa adanya: fallback Helvetica
         hanya bila tidak ada karakter yang akan dihapus pdfSafe.
         Gerbang kejujuran C-4: bila teks kotak tulis sudah berubah
         sejak analisis, laporan tetap mencetak teks persis seperti
         yang dianalisis dan perubahan itu diungkapkan tercetak pada
         halaman pertama + status; temuan yang jangkarnya putus tampil
         tanpa penanda dengan catatannya (dari model). */
      var diAnnotBtn = $("wi-report-annot"), diAnnotStatusEl = $("wi-report-annot-status");
      function diAnnotSetStatus(msg){ if(diAnnotStatusEl) diAnnotStatusEl.textContent = msg || ""; }
      function diAnnotExecOp(R, op){
        var doc = R.doc;
        if(op.op === "rect"){
          doc.setFillColor(op.fill[0], op.fill[1], op.fill[2]);
          doc.rect(op.x, op.y, op.w, op.h, "F");
        } else if(op.op === "rects"){
          doc.setDrawColor(op.color[0], op.color[1], op.color[2]);
          doc.setLineWidth(op.width || 0.25);
          doc.rect(op.x, op.y, op.w, op.h, "S");
        } else if(op.op === "line"){
          doc.setDrawColor(op.color[0], op.color[1], op.color[2]);
          doc.setLineWidth(op.width || 0.25);
          if(op.dash) doc.setLineDashPattern(op.dash, 0);
          doc.line(op.x1, op.y1, op.x2, op.y2);
          if(op.dash) doc.setLineDashPattern([], 0);
        } else if(op.op === "text"){
          doc.setFont(R.font, op.bold ? "bold" : "normal");
          doc.setFontSize(op.size);
          doc.setTextColor(op.color[0], op.color[1], op.color[2]);
          doc.text(op.text, op.x, op.y);
          doc.setTextColor(0);
        } else if(op.op === "num"){
          doc.setFont(R.font, "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(op.color[0], op.color[1], op.color[2]);
          doc.text(op.text, op.x, op.y);
          doc.setTextColor(0);
        }
      }
      function diAnnotStamp(R, dateStr){
        var n = R.doc.getNumberOfPages();
        var left = "Saksara \u00B7 Laporan Anotasi Tulisan \u00B7 dibuat lokal di peramban ini \u00B7 " + dateStr;
        for(var i = 1; i <= n; i++){
          R.doc.setPage(i);
          R.doc.setFont(R.font, "normal");
          R.doc.setFontSize(8);
          R.doc.setTextColor(120);
          R.doc.text(diPdfTxt(R, left), DI_PDF_M, 290);
          R.doc.text(diPdfTxt(R, "Halaman " + i + " dari " + n), DI_PDF_W - DI_PDF_M, 290, { align: "right" });
        }
        R.doc.setTextColor(0);
      }
      async function diExportAnnotatedPdf(){
        if(!wiResult){
          diAnnotSetStatus("Belum ada laporan \u2014 jalankan analisis terlebih dahulu, lalu ekspor PDF beranotasi-nya.");
          return;
        }
        diAnnotBtn.disabled = true;
        diAnnotSetStatus("Menyiapkan PDF beranotasi\u2026");
        try {
          var jsPDF = await loadJsPdf();
          var fonts = null;
          try { fonts = await diLoadReportFonts(); } catch(eFont) { fonts = null; }
          var useFont = !!fonts;
          var coverage = useFont ? fonts.coverage : null;
          var edited = ta.value !== wiJoin(wiResult.paragraphs, wiResult.separators);
          var ex = { acceptedIds: wiAccepted.slice(), rejectedIds: Object.keys(wiRejected),
            kindLabels: WI_KIND_LABEL, certLabels: WI_CERT_LABEL, coverage: coverage };
          if(wiDocState){
            diEnsureMapping();
            ex.doc = { name: wiDocState.name, model: wiDocState.model, mapping: diMapping };
          }
          var A = annotBuildReport(wiResult, ex);
          var dateStr = new Date().toLocaleString("id-ID");
          var recs = diReportModel ? (diReportModel.recommendations || []) : [];
          var lims = diReportModel ? (diReportModel.limitations || []) : [];
          var kit = p6PdfKit(jsPDF, "Laporan Anotasi Tulisan \u2014 Saksara");
          var doc = kit.doc;
          if(useFont){
            doc.addFileToVFS(DI_PDF_FONT_VFS.normal, fonts.normal);
            doc.addFont(DI_PDF_FONT_VFS.normal, DI_PDF_FONT_FAMILY, "normal");
            doc.addFileToVFS(DI_PDF_FONT_VFS.bold, fonts.bold);
            doc.addFont(DI_PDF_FONT_VFS.bold, DI_PDF_FONT_FAMILY, "bold");
          }
          var R = { doc: doc, kit: kit, font: useFont ? DI_PDF_FONT_FAMILY : "helvetica", safe: !useFont };
          if(!useFont){
            var texts = ["Saksara", "LAPORAN ANOTASI TULISAN", DI_PDF_FALLBACK_NOTICE, ANNOT_MANUAL_REVIEW_LABEL];
            A.renderBlocks.forEach(function(b){ texts.push(b.text); });
            A.findings.forEach(function(f){
              texts.push(f.kindLabel); texts.push(f.certaintyLabel);
              texts.push(f.sentenceText); texts.push(f.explanation || "");
              if(f.proposedSentence) texts.push(f.proposedSentence);
              if(f.anchor && f.anchor.note) texts.push(f.anchor.note);
            });
            recs.concat(lims).forEach(function(s){ texts.push(s); });
            if(A.source.fileName) texts.push(A.source.fileName);
            var deleted = diPdfHelveticaDeleted(texts);
            if(deleted.length){
              diAnnotSetStatus("Ekspor dihentikan: font laporan (Noto Sans) gagal dimuat, dan karakter berikut akan hilang bila dicetak dengan font cadangan: " + diPdfUnsupportedText(deleted) + ". PDF tidak dibuat \u2014 periksa koneksi internet lalu coba lagi.");
              return;
            }
          }
          var measure = function(text, style){
            doc.setFont(R.font, style.bold ? "bold" : "normal");
            doc.setFontSize(style.size);
            return doc.getTextWidth(text);
          };
          var plan = annotPdfLayout(A, {
            measure: measure, coverage: coverage,
            display: useFont ? null : function(t){ return pdfSafe(t); },
            dateStr: dateStr, editedNote: edited,
            stateLabels: DI_REPORT_STATE_TEXT,
            recommendations: recs, limitations: lims,
            fallbackNotice: useFont ? null : DI_PDF_FALLBACK_NOTICE
          });
          plan.pages.forEach(function(pageOps, pi){
            if(pi > 0) doc.addPage();
            pageOps.forEach(function(op){ diAnnotExecOp(R, op); });
          });
          diAnnotStamp(R, dateStr);
          var fileName = annotPdfFileName(new Date());
          doc.save(fileName);
          var msg;
          if(useFont){
            msg = "PDF beranotasi dibuat: " + fileName + " \u2014 dicetak dengan font Noto Sans subset.";
            if(plan.disclosure) msg += " Sebanyak " + plan.disclosure.total + " kemunculan karakter di luar cakupan font diganti penanda " + ANNOT_PDF_PLACEHOLDER + " dengan pengungkapan tercetak di dalam laporan.";
          } else {
            msg = "PDF beranotasi dibuat dengan font cadangan (Helvetica) karena font utama gagal dimuat: " + fileName + " \u2014 beberapa karakter tipografis disederhanakan.";
          }
          if(edited) msg += " Catatan: teks telah berubah sejak analisis terakhir \u2014 laporan mencetak teks persis seperti yang dianalisis.";
          diAnnotSetStatus(msg);
        } catch(e){
          diAnnotSetStatus("Ekspor PDF beranotasi gagal: " + (e && e.message ? e.message : e));
        } finally {
          diAnnotBtn.disabled = false;
        }
      }
      if(diAnnotBtn) diAnnotBtn.addEventListener("click", function(){ diExportAnnotatedPdf(); });

      /* ================= Document Intelligence (D8 Tahap 3): Ekspor setia-asli =================
         Untuk dokumen yang diimpor, ekspor utama kini adalah BERKAS
         ASAL itu sendiri: DOCX dibedah pada word/document.xml-nya
         (sorotan + nomor pada run asal, rekomendasi ditambahkan di
         akhir isi; hasil diverifikasi sebelum diunduh, cadangan =
         bangun ulang dari model dengan sorotan yang sama), dan PDF
         digambari sorotan tepat di atas halaman asalnya dengan
         pdf-lib (halaman asal tidak digambar ulang) + halaman
         rekomendasi di belakang. Gerbang kejujuran PDF (teks rusak,
         halaman terputar, geometri tidak pasti, karakter halaman
         rekomendasi) menolak overlay dan menawarkan PDF Beranotasi
         susun-ulang yang sudah ada, dengan alasan sederhana.
         Byte asal hanya hidup di memori halaman ini (salinan, karena
         pdf.js dapat memindahkan buffer yang diserahkan kepadanya);
         tidak diunggah dan tidak disimpan — sikap privasi yang sama
         dengan model dokumen. Ekspor lama tidak diubah. */
      var DI_PDFLIB_URL = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      var DI_PDFLIB_SRI = "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI";
      if(typeof SAKSARA_SRI !== "undefined" && SAKSARA_SRI && !SAKSARA_SRI[DI_PDFLIB_URL])
        SAKSARA_SRI[DI_PDFLIB_URL] = DI_PDFLIB_SRI;
      var diPdfLibPromise = null;
      function diLoadPdfLib(){
        if(window.PDFLib && window.PDFLib.PDFDocument) return Promise.resolve(window.PDFLib);
        if(!diPdfLibPromise){
          diPdfLibPromise = p6LoadScript(DI_PDFLIB_URL).then(function(){
            if(!window.PDFLib || !window.PDFLib.PDFDocument)
              throw new Error("global PDFLib tidak lengkap");
            return window.PDFLib;
          });
          diPdfLibPromise.catch(function(){ diPdfLibPromise = null; });
        }
        return diPdfLibPromise;
      }
      var diFaithfulState = { name: null, kind: null, bytes: null, pagesData: null, pageDims: null };
      function diFaithfulReset(){
        diFaithfulState = { name: null, kind: null, bytes: null, pagesData: null, pageDims: null };
        diFaithfulRefresh();
      }
      function diFaithfulCapture(name, bytes){
        diFaithfulState = { name: name, kind: diSniffFormat(bytes) === "pdf" ? "pdf" : "docx",
          bytes: bytes.slice(), pagesData: null, pageDims: null };
      }
      function diFaithfulNotePdfPage(n, page){
        try {
          var view = page.view || [0, 0, 612, 842];
          if(!diFaithfulState.pageDims) diFaithfulState.pageDims = {};
          diFaithfulState.pageDims[n] = { width: view[2] - view[0], height: view[3] - view[1],
            rotation: page.rotate || 0 };
        } catch(e){ /* dimensi tak tersedia — gerbang ekspor menolak dengan jujur */ }
      }
      function diFaithfulNotePdfPages(pagesData){ diFaithfulState.pagesData = pagesData; }
      var diFaithDocxBtn = $("wi-faithful-docx"), diFaithPdfBtn = $("wi-faithful-pdf"),
          diFaithStatusEl = $("wi-faithful-status");
      function diFaithSetStatus(msg){ if(diFaithStatusEl) diFaithStatusEl.textContent = msg || ""; }
      function diFaithfulRefresh(){
        var kind = (wiDocState && diFaithfulState.bytes && diFaithfulState.name === wiDocState.name)
          ? diFaithfulState.kind : null;
        if(diFaithDocxBtn) diFaithDocxBtn.hidden = kind !== "docx";
        if(diFaithPdfBtn) diFaithPdfBtn.hidden = kind !== "pdf";
      }
      if(typeof MutationObserver === "function"){
        if(statusEl) new MutationObserver(diFaithfulRefresh).observe(statusEl, { childList: true, characterData: true });
        if(diCountEl) new MutationObserver(diFaithfulRefresh).observe(diCountEl, { childList: true, characterData: true, subtree: true });
      }
      function diFaithfulBuildAnnot(){
        if(!wiResult || !wiDocState) return null;
        diEnsureMapping();
        return annotBuildReport(wiResult, { acceptedIds: wiAccepted.slice(),
          rejectedIds: Object.keys(wiRejected), kindLabels: WI_KIND_LABEL,
          certLabels: WI_CERT_LABEL,
          doc: { name: wiDocState.name, model: wiDocState.model, mapping: diMapping } });
      }
      function diFaithfulDownload(blob, name){
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 400);
      }
      var diFaithBusy = false;
      /* ----- DOCX setia-asli ----- */
      function diFaithfulDocxRunsMarked(dx, block, marks){
        var out = [];
        diFaithfulBlockSegments(block, marks).forEach(function(p){
          if(p.insertNo != null){
            out.push(new dx.TextRun({ text: String(p.insertNo), superScript: true, bold: true, color: "1D5FD1", size: 16 }));
            return;
          }
          if(p.prot){ if(p.kind !== "object" && p.text) out.push(new dx.TextRun({ text: p.text })); return; }
          var props = {};
          if(p.bold) props.bold = true;
          if(p.italic) props.italics = true;
          if(p.underline) props.underline = {};
          if(p.fontName) props.font = { name: p.fontName };
          if(typeof p.fontSize === "number" && p.fontSize > 0) props.size = Math.round(p.fontSize * 2);
          if(p.hl) props.highlight = p.hl;
          var safe = p.link ? diLinkSafe(p.link) : null;
          String(p.text).split("\n").forEach(function(seg, i){
            var pr = {};
            for(var k in props) pr[k] = props[k];
            pr.text = seg;
            if(i > 0) pr.break = 1;
            var tr = new dx.TextRun(pr);
            out.push(safe ? new dx.ExternalHyperlink({ link: safe, children: [tr] }) : tr);
          });
        });
        return out;
      }
      function diFaithfulDocxPara(dx, b, marks){
        if(b.type === "heading"){
          var lv = Math.min(6, Math.max(1, b.level || 1));
          return new dx.Paragraph({ heading: dx.HeadingLevel["HEADING_" + lv], outlineLevel: lv - 1,
            alignment: diDocxAlign(dx, b), indent: diDocxIndent(b),
            children: diFaithfulDocxRunsMarked(dx, b, marks) });
        }
        if(b.type === "list-item"){
          return new dx.Paragraph({ alignment: diDocxAlign(dx, b),
            indent: { left: 360 * ((b.level || 0) + 1), hanging: 260 },
            children: diFaithfulDocxRunsMarked(dx, b, marks) });
        }
        return new dx.Paragraph({ alignment: diDocxAlign(dx, b), indent: diDocxIndent(b),
          children: diFaithfulDocxRunsMarked(dx, b, marks) });
      }
      function diFaithfulDocxTable(dx, model, tIdx, idxById, inc){
        var table = (model.tables || [])[tIdx];
        if(!table) return null;
        var byId = {};
        (model.blocks || []).forEach(function(b){ byId[b.id] = b; });
        var rows = (table.rows || []).map(function(row){
          var cells = (row.cells || []).map(function(cell){
            var opts = {};
            if(cell.gridSpan > 1) opts.columnSpan = cell.gridSpan;
            if(cell.vMerge === "restart") opts.verticalMerge = dx.VerticalMergeType.RESTART;
            else if(cell.vMerge === "continue") opts.verticalMerge = dx.VerticalMergeType.CONTINUE;
            var cbs = (cell.blockIds || []).map(function(id){ return byId[id]; }).filter(Boolean)
              .sort(function(x, y){ return (x.cellPara || 0) - (y.cellPara || 0); });
            opts.children = cbs.length
              ? cbs.map(function(b){
                  return new dx.Paragraph({ children: diFaithfulDocxRunsMarked(dx, b, inc.marksByBlock[idxById[b.id]] || []) });
                })
              : [new dx.Paragraph("")];
            return new dx.TableCell(opts);
          });
          return new dx.TableRow({ children: cells });
        });
        return new dx.Table({ rows: rows });
      }
      function diFaithfulAppendixParasDx(dx, children, it){
        var head = [];
        if(it.no != null) head.push(new dx.TextRun({ text: it.no + ". ", bold: true }));
        head.push(new dx.TextRun({ text: "Kalimat asli: ", bold: true }));
        head.push(new dx.TextRun({ text: "\"" + it.sentence + "\"" }));
        children.push(new dx.Paragraph({ children: head }));
        children.push(new dx.Paragraph({ children: [
          new dx.TextRun({ text: "Alasan: ", bold: true }), new dx.TextRun({ text: it.reason })] }));
        if(it.manual){
          children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: "Perlu ditinjau manual.", bold: true })] }));
        } else {
          children.push(new dx.Paragraph({ children: [
            new dx.TextRun({ text: "Usulan perbaikan: ", bold: true }),
            new dx.TextRun({ text: "\"" + it.proposal + "\"" })] }));
        }
      }
      function diFaithfulFallbackDocx(A, fileName){
        return diLoadDocx().then(function(dx){
          var model = wiDocState.model;
          var inc = diFaithfulIncluded(A);
          var idxById = {};
          (model.blocks || []).forEach(function(b, bi){ idxById[b.id] = bi; });
          var children = [], emitted = {};
          (model.blocks || []).forEach(function(b, bi){
            if(b.type === "table-cell"){
              if(!emitted[b.table]){
                emitted[b.table] = true;
                var t = diFaithfulDocxTable(dx, model, b.table, idxById, inc);
                if(t) children.push(t);
              }
              return;
            }
            children.push(diFaithfulDocxPara(dx, b, inc.marksByBlock[bi] || []));
          });
          var app = diFaithfulAppendix(A);
          children.push(new dx.Paragraph({ spacing: { before: 360 },
            children: [new dx.TextRun({ text: app.heading, bold: true, size: 32 })] }));
          children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: app.intro })] }));
          app.items.forEach(function(it){ diFaithfulAppendixParasDx(dx, children, it); });
          if(app.unanchoredIntro){
            children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: app.unanchoredIntro, italics: true })] }));
            app.unanchoredItems.forEach(function(it){ diFaithfulAppendixParasDx(dx, children, it); });
          }
          if(app.emptyNote) children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: app.emptyNote })] }));
          return dx.Packer.toBlob(new dx.Document({ sections: [{ children: children }] }));
        }).then(function(blob){ diFaithfulDownload(blob, fileName); });
      }
      async function diExportFaithfulDocx(){
        if(diFaithBusy) return;
        if(!wiResult){ diFaithSetStatus("Jalankan analisis terlebih dahulu, lalu unduh dokumen beranotasinya."); return; }
        if(!wiDocState || !diFaithfulState.bytes || diFaithfulState.kind !== "docx"){
          diFaithSetStatus("Dokumen Word asal tidak tersedia — impor ulang berkas .docx-nya, lalu coba lagi.");
          return;
        }
        diFaithBusy = true;
        if(diFaithDocxBtn) diFaithDocxBtn.disabled = true;
        diFaithSetStatus("Menyiapkan dokumen beranotasi…");
        try {
          var A = diFaithfulBuildAnnot();
          var fileName = diFaithfulFileName(wiDocState.name);
          var surgery = await diFaithfulDocxSurgery(diFaithfulState.bytes, wiDocState.model, A, {});
          if(surgery.ok){
            var verify = await diFaithfulVerifyDocx(diFaithfulState.bytes, surgery.bytes, wiDocState.model, A, {});
            if(!verify.ok){
              if(window.console && console.warn) console.warn("Saksara: verifikasi bedah DOCX gagal", verify.failures);
              surgery = { ok: false, reason: "verify" };
            }
          }
          if(surgery.ok){
            diFaithfulDownload(new Blob([surgery.bytes],
              { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), fileName);
            diFaithSetStatus("Dokumen beranotasi dibuat: " + fileName + " — dokumen asli Anda dengan sorotan dan rekomendasi di bagian akhir.");
          } else {
            await diFaithfulFallbackDocx(A, fileName);
            diFaithSetStatus("Dokumen beranotasi dibuat: " + fileName + " — catatan: untuk berkas ini dokumen dibangun ulang dari hasil impor, jadi tampilannya mungkin sedikit berbeda dari berkas asli.");
          }
        } catch(e){
          if(window.console && console.warn) console.warn("Saksara: ekspor setia-asli DOCX gagal", e && e.message);
          diFaithSetStatus("Unduhan gagal — coba lagi. Bila tetap gagal, gunakan tombol Ekspor PDF Beranotasi.");
        } finally {
          diFaithBusy = false;
          if(diFaithDocxBtn) diFaithDocxBtn.disabled = false;
        }
      }
      if(diFaithDocxBtn) diFaithDocxBtn.addEventListener("click", function(){ diExportFaithfulDocx(); });
      /* ----- PDF setia-asli (overlay pdf-lib) ----- */
      function diFaithfulWrap(font, text, size, maxW){
        var words = String(text).split(/\s+/), lines = [], cur = "";
        words.forEach(function(w){
          var t = cur ? cur + " " + w : w;
          if(cur && font.widthOfTextAtSize(t, size) > maxW){ lines.push(cur); cur = w; }
          else cur = t;
        });
        if(cur) lines.push(cur);
        return lines.length ? lines : [""];
      }
      function diFaithfulDrawAppendix(PL, pdfDoc, helv, helvB, lines, size){
        var M = 56, W = size.width, H = size.height, TOP = H - 64, BOT = 56;
        var page = null, y = 0;
        function newPage(){ page = pdfDoc.addPage([W, H]); y = TOP; }
        newPage();
        lines.forEach(function(ln){
          var font = ln.bold ? helvB : helv;
          diFaithfulWrap(font, ln.text, ln.size, W - 2 * M).forEach(function(wl){
            if(y < BOT) newPage();
            page.drawText(wl, { x: M, y: y, size: ln.size, font: font, color: PL.rgb(0.1, 0.1, 0.1) });
            y -= ln.size * 1.45;
          });
          y -= ln.gapAfter || 4;
        });
      }
      async function diExportFaithfulPdf(){
        if(diFaithBusy) return;
        if(!wiResult){ diFaithSetStatus("Jalankan analisis terlebih dahulu, lalu unduh PDF beranotasinya."); return; }
        if(!wiDocState || !diFaithfulState.bytes || diFaithfulState.kind !== "pdf"){
          diFaithSetStatus("PDF asal tidak tersedia — impor ulang berkas .pdf-nya, lalu coba lagi.");
          return;
        }
        diFaithBusy = true;
        if(diFaithPdfBtn) diFaithPdfBtn.disabled = true;
        diFaithSetStatus("Menyiapkan PDF beranotasi…");
        try {
          var A = diFaithfulBuildAnnot();
          var plan = diFaithfulPdfPlan(diFaithfulState.pagesData, wiDocState.model, A, diFaithfulState.pageDims);
          if(!plan.ok){
            var why = { "garbled": "lapisan teks PDF ini tidak terbaca dengan utuh",
              "rotation": "halaman PDF ini terputar",
              "geometry-mismatch": "posisi teks PDF ini tidak dapat dipastikan",
              "appendix-chars": "sebagian tulisan memakai karakter yang tidak dapat dicetak pada halaman rekomendasi",
              "no-pages": "data halaman PDF tidak tersedia" }[plan.reason] || "posisi teks PDF ini tidak dapat dipastikan";
            diFaithSetStatus("Sorotan tidak dapat digambar tepat di atas PDF asli karena " + why + ". Sebagai gantinya dibuat laporan beranotasi (susunan Saksara).");
            await diExportAnnotatedPdf();
            return;
          }
          var PL = await diLoadPdfLib();
          var pdfDoc = await PL.PDFDocument.load(diFaithfulState.bytes);
          var helv = await pdfDoc.embedFont(PL.StandardFonts.Helvetica);
          var helvB = await pdfDoc.embedFont(PL.StandardFonts.HelveticaBold);
          var pages = pdfDoc.getPages();
          plan.rects.forEach(function(r){
            var page = pages[r.page - 1];
            if(!page) return;
            page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h,
              color: r.advisory ? PL.rgb(0.62, 0.84, 1) : PL.rgb(1, 0.93, 0.55), opacity: 0.5 });
          });
          plan.labels.forEach(function(l){
            var page = pages[l.page - 1];
            if(!page) return;
            page.drawText(String(l.no), { x: l.x, y: l.y, size: 7, font: helvB, color: PL.rgb(0.11, 0.37, 0.82) });
          });
          var firstSize = pages.length ? pages[0].getSize() : { width: 595, height: 842 };
          diFaithfulDrawAppendix(PL, pdfDoc, helv, helvB, plan.appendixLines, firstSize);
          var outBytes = await pdfDoc.save();
          var fileName = diFaithfulFileName(wiDocState.name);
          diFaithfulDownload(new Blob([outBytes], { type: "application/pdf" }), fileName);
          diFaithSetStatus("PDF beranotasi dibuat: " + fileName + " — halaman asli PDF Anda dengan sorotan dan rekomendasi di halaman akhir.");
        } catch(e){
          if(window.console && console.warn) console.warn("Saksara: ekspor setia-asli PDF gagal", e && e.message);
          diFaithSetStatus("Unduhan gagal — coba lagi. Bila tetap gagal, gunakan tombol Ekspor PDF Beranotasi.");
        } finally {
          diFaithBusy = false;
          if(diFaithPdfBtn) diFaithPdfBtn.disabled = false;
        }
      }
      if(diFaithPdfBtn) diFaithPdfBtn.addEventListener("click", function(){ diExportFaithfulPdf(); });
    })();

    /* ================= Compare Writing (Phase 4) =================
       Mesin perbandingan dokumen. Berdiri sendiri: TIDAK menjalankan Detector
       dan tidak memakai skor deteksi apa pun. */
    /* CMP-CORE-START — fungsi murni (tanpa DOM), dapat diekstrak & diuji terpisah. */
    function cmpTokens(text){
      var re = /[\p{L}\p{N}']+/gu, out = [], m;
      while((m = re.exec(text)) !== null) out.push({ t: m[0], k: m[0].toLowerCase() });
      return out;
    }
    function cmpLisKeep(seq){
      var tails = [], tailIdx = [], prev = new Array(seq.length).fill(-1);
      seq.forEach(function(x, i){
        var lo = 0, hi = tails.length;
        while(lo < hi){ var mid = (lo + hi) >> 1; if(tails[mid] < x) lo = mid + 1; else hi = mid; }
        tails[lo] = x; tailIdx[lo] = i; prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
      });
      var keep = new Set(), k = tailIdx[tails.length - 1];
      while(k !== undefined && k >= 0){ keep.add(k); k = prev[k]; }
      return keep;
    }
    function cmpAlign(aUnits, bUnits){
      var bQueues = Object.create(null);
      bUnits.forEach(function(u, j){ (bQueues[u.key] || (bQueues[u.key] = [])).push(j); });
      var aMatch = aUnits.map(function(){ return -1; });
      var bUsed = bUnits.map(function(){ return false; });
      aUnits.forEach(function(u, i){ var q = bQueues[u.key]; if(q && q.length){ aMatch[i] = q.shift(); bUsed[aMatch[i]] = true; } });
      var seq = [], seqA = [];
      aMatch.forEach(function(b, i){ if(b >= 0){ seq.push(b); seqA.push(i); } });
      var keep = cmpLisKeep(seq), moved = Object.create(null);
      seqA.forEach(function(ai, pos){ if(!keep.has(pos)) moved[ai] = true; });
      var pairs = [];
      aUnits.forEach(function(u, i){ if(aMatch[i] >= 0) pairs.push({ a: i, b: aMatch[i], kind: moved[i] ? "moved" : "same" }); });
      var aLeft = [], bLeft = [];
      aUnits.forEach(function(u, i){ if(aMatch[i] < 0) aLeft.push(i); });
      bUnits.forEach(function(u, j){ if(!bUsed[j]) bLeft.push(j); });
      var n = Math.min(aLeft.length, bLeft.length), k;
      for(k = 0; k < n; k++) pairs.push({ a: aLeft[k], b: bLeft[k], kind: "changed" });
      for(k = n; k < aLeft.length; k++) pairs.push({ a: aLeft[k], b: -1, kind: "removed" });
      for(k = n; k < bLeft.length; k++) pairs.push({ a: -1, b: bLeft[k], kind: "added" });
      pairs.forEach(function(p){
        if(p.a >= 0){ p.sortKey = p.a; return; }
        var best = -1;
        pairs.forEach(function(q){ if(q.b >= 0 && q.b < p.b && q.a > best) best = q.a; });
        p.sortKey = best + 0.5;
      });
      pairs.sort(function(x, y){ return x.sortKey - y.sortKey || x.b - y.b; });
      return pairs;
    }
    function cmpWordDiff(aToks, bToks){
      var n = aToks.length, m = bToks.length;
      if(n * m > 1000000) return null;
      var dp = [], i, j;
      for(i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
      for(i = n - 1; i >= 0; i--) for(j = m - 1; j >= 0; j--) dp[i][j] = aToks[i].k === bToks[j].k ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      var ops = []; i = 0; j = 0;
      while(i < n && j < m){
        if(aToks[i].k === bToks[j].k){ ops.push({ type: "eq", a: aToks[i], b: bToks[j] }); i++; j++; }
        else if(dp[i + 1][j] >= dp[i][j + 1]){ ops.push({ type: "del", a: aToks[i] }); i++; }
        else { ops.push({ type: "ins", b: bToks[j] }); j++; }
      }
      while(i < n){ ops.push({ type: "del", a: aToks[i] }); i++; }
      while(j < m){ ops.push({ type: "ins", b: bToks[j] }); j++; }
      return ops;
    }
    function cmpCountOps(ops){
      var eq = 0, del = 0, ins = 0, chg = 0, i = 0;
      while(i < ops.length){
        if(ops[i].type === "eq"){ eq++; i++; continue; }
        var d = 0, s = 0;
        while(i < ops.length && ops[i].type !== "eq"){ if(ops[i].type === "del") d++; else s++; i++; }
        var c = Math.min(d, s); chg += c; del += d - c; ins += s - c;
      }
      return { eq: eq, del: del, ins: ins, chg: chg };
    }
    function cmpDiff(textA, textB){
      var wordsA = wordsOf(textA), wordsB = wordsOf(textB);
      var parasAT = splitParagraphs(textA), parasBT = splitParagraphs(textB);
      if(!parasAT.length && textA.trim()) parasAT = [textA];
      if(!parasBT.length && textB.trim()) parasBT = [textB];
      var pA = parasAT.map(function(t){ return { text: t, key: wordsOf(t).join(" ") }; });
      var pB = parasBT.map(function(t){ return { text: t, key: wordsOf(t).join(" ") }; });
      var pairs = cmpAlign(pA, pB);
      var R = { wordsA: wordsA.length, wordsB: wordsB.length, parasA: pA.length, parasB: pB.length,
        sentsA: 0, sentsB: 0, matchedWords: 0, wAdd: 0, wDel: 0, wChg: 0, sAdd: 0, sDel: 0, sChg: 0,
        pAdd: 0, pDel: 0, pChg: 0, pMoved: 0, rows: [], changedPairs: [], summarizedPairs: 0 };
      pairs.forEach(function(pr){
        var aPara = pr.a >= 0 ? pA[pr.a] : null, bPara = pr.b >= 0 ? pB[pr.b] : null;
        var aSents = aPara ? splitSentences(aPara.text) : [], bSents = bPara ? splitSentences(bPara.text) : [];
        R.sentsA += aSents.length; R.sentsB += bSents.length;
        if(pr.kind === "same" || pr.kind === "moved"){
          if(pr.kind === "moved"){ R.pMoved++; R.rows.push({ kind: "note", text: "Paragraf berikut ini berpindah urutan — isinya sama persis." }); }
          R.matchedWords += wordsOf(aPara.text).length;
          if(aSents.length === bSents.length){
            aSents.forEach(function(s, i){ R.rows.push({ kind: "same", aText: s, bText: bSents[i], paraStart: i === 0 }); });
          } else {
            R.rows.push({ kind: "same", aText: aPara.text, bText: bPara.text, paraStart: true });
          }
        } else if(pr.kind === "removed"){
          R.pDel++;
          aSents.forEach(function(s, i){ R.sDel++; R.wDel += wordsOf(s).length; R.rows.push({ kind: "removed", aText: s, paraStart: i === 0 }); });
        } else if(pr.kind === "added"){
          R.pAdd++;
          bSents.forEach(function(s, i){ R.sAdd++; R.wAdd += wordsOf(s).length; R.rows.push({ kind: "added", bText: s, paraStart: i === 0 }); });
        } else {
          R.pChg++;
          var sA = aSents.map(function(t){ return { text: t, key: wordsOf(t).join(" ") }; });
          var sB = bSents.map(function(t){ return { text: t, key: wordsOf(t).join(" ") }; });
          var sp = cmpAlign(sA, sB);
          sp.forEach(function(sr, ri){
            var first = ri === 0;
            if(sr.kind === "same" || sr.kind === "moved"){
              R.matchedWords += wordsOf(sA[sr.a].text).length;
              R.rows.push({ kind: "same", aText: sA[sr.a].text, bText: sB[sr.b].text, paraStart: first });
            } else if(sr.kind === "removed"){
              R.sDel++; R.wDel += wordsOf(sA[sr.a].text).length;
              R.rows.push({ kind: "removed", aText: sA[sr.a].text, paraStart: first });
            } else if(sr.kind === "added"){
              R.sAdd++; R.wAdd += wordsOf(sB[sr.b].text).length;
              R.rows.push({ kind: "added", bText: sB[sr.b].text, paraStart: first });
            } else {
              R.sChg++;
              var aT = cmpTokens(sA[sr.a].text), bT = cmpTokens(sB[sr.b].text);
              var ops = cmpWordDiff(aT, bT), counts;
              if(ops){ counts = cmpCountOps(ops); }
              else {
                R.summarizedPairs++;
                var fa = Object.create(null), fb = Object.create(null), kk;
                aT.forEach(function(t){ fa[t.k] = (fa[t.k] || 0) + 1; });
                bT.forEach(function(t){ fb[t.k] = (fb[t.k] || 0) + 1; });
                var eq2 = 0, d2 = 0, i2 = 0;
                for(kk in fa){ var c = Math.min(fa[kk], fb[kk] || 0); eq2 += c; d2 += fa[kk] - c; }
                for(kk in fb){ i2 += fb[kk] - Math.min(fa[kk] || 0, fb[kk]); }
                counts = { eq: eq2, del: d2, ins: i2, chg: 0 };
              }
              R.matchedWords += counts.eq; R.wDel += counts.del; R.wAdd += counts.ins; R.wChg += counts.chg;
              R.rows.push({ kind: "changed", aText: sA[sr.a].text, bText: sB[sr.b].text, ops: ops, paraStart: first });
              R.changedPairs.push({ aText: sA[sr.a].text, bText: sB[sr.b].text });
            }
          });
        }
      });
      R.similarity = (R.wordsA + R.wordsB) ? (2 * R.matchedWords) / (R.wordsA + R.wordsB) : 1;
      R.identical = R.wAdd === 0 && R.wDel === 0 && R.wChg === 0 && R.sAdd === 0 && R.sDel === 0 && R.pAdd === 0 && R.pDel === 0 && R.pMoved === 0;
      R.surfaceOnly = R.identical && textA.trim() !== textB.trim();
      return R;
    }
    /* CMP-CORE-END */

    /* Compare Writing — render & interaksi (DOM). */
    var cmpLast = null;
    function cmpDeltaTxt(a, b, fmt){
      var d = b - a;
      if(Math.abs(d) < 1e-9) return "± 0";
      return (d > 0 ? "▲ +" : "▼ −") + fmt(Math.abs(d));
    }
    function cmpOpsHtmlA(ops){
      if(!ops) return null;
      return ops.filter(function(o){ return o.type !== "ins"; }).map(function(o){
        return o.type === "eq" ? escapeHtml(o.a.t) : "<span class=\"seg-del\">" + escapeHtml(o.a.t) + "</span>";
      }).join(" ");
    }
    function cmpOpsHtmlB(ops){
      if(!ops) return null;
      return ops.filter(function(o){ return o.type !== "del"; }).map(function(o){
        return o.type === "eq" ? escapeHtml(o.b.t) : "<span class=\"seg-add\">" + escapeHtml(o.b.t) + "</span>";
      }).join(" ");
    }
    function cmpOpsHtmlInline(ops){
      if(!ops) return null;
      return ops.map(function(o){
        if(o.type === "eq") return escapeHtml(o.a.t);
        if(o.type === "del") return "<span class=\"seg-del\">" + escapeHtml(o.a.t) + "</span>";
        return "<span class=\"seg-add\">" + escapeHtml(o.b.t) + "</span>";
      }).join(" ");
    }
    function cmpRender(R, fa, fb){
      var cards = [
        [wfFmt(R.similarity * 100) + "%", "kemiripan tekstual (Dice)"],
        [fmtNumID(R.wordsA) + " → " + fmtNumID(R.wordsB), "kata (A → B)"],
        ["+" + fmtNumID(R.wAdd), "kata ditambah di B"],
        ["−" + fmtNumID(R.wDel), "kata dihapus dari A"],
        ["≈" + fmtNumID(R.wChg), "kata berubah"],
        [fmtNumID(R.sChg + R.sAdd + R.sDel), "kalimat berubah/tambah/hapus"],
        [fmtNumID(R.pMoved), "paragraf berpindah urutan"],
        [fmtNumID(R.changedPairs.length), "pasangan kalimat berubah"]
      ];
      $("cmp-cards").innerHTML = cards.map(function(c){ return "<div class=\"wf-card\"><div class=\"n\">" + c[0] + "</div><div class=\"t\">" + c[1] + "</div></div>"; }).join("");

      var sb = $("cmp-surface");
      if(R.identical && !R.surfaceOnly){ sb.innerHTML = "<strong>Kedua dokumen identik</strong> pada tingkat kata — tidak ada perbedaan isi, urutan, maupun permukaan teks."; sb.classList.add("show"); }
      else if(R.surfaceOnly){ sb.innerHTML = "<strong>Isi kedua dokumen sama persis.</strong> Perbedaan hanya pada permukaan teks (tanda baca, kapitalisasi, dan/atau spasi) — perbandingan kata memang menormalisasi ketiganya, jadi tidak ada kata yang berubah."; sb.classList.add("show"); }
      else if(R.summarizedPairs){ sb.innerHTML = "Catatan: " + R.summarizedPairs + " pasangan kalimat sangat besar diringkas dengan selisih himpunan kata (tanpa diff kata rinci) agar perbandingan tetap cepat."; sb.classList.add("show"); }
      else { sb.innerHTML = ""; sb.classList.remove("show"); }

      var ch = $("cmp-human");
      if(R.identical && !R.surfaceOnly){ ch.innerHTML = "<strong>Kesimpulan sederhana:</strong> kedua tulisan ini sama persis — tidak ada satu kata pun yang berbeda."; }
      else {
        var simTxt = R.similarity >= 0.95 ? "hampir sama persis" : (R.similarity >= 0.8 ? "sangat mirip" : (R.similarity >= 0.5 ? "mirip sebagian" : "banyak berbeda"));
        ch.innerHTML = "<strong>Kesimpulan sederhana:</strong> kedua tulisan ini <strong>" + simTxt + "</strong> — sekitar " + wfFmt(R.similarity * 100) + "% isinya sama. Dibandingkan tulisan A, tulisan B <strong>menambah " + fmtNumID(R.wAdd) + " kata</strong>, <strong>menghapus " + fmtNumID(R.wDel) + " kata</strong>, dan <strong>mengubah " + fmtNumID(R.wChg) + " kata</strong>. Rincian per bagian ada di bawah.";
      }
      ch.classList.add("show");

      $("cmp-changes").innerHTML = wfTable([
        ["Kata — ditambah / dihapus / berubah", "+" + R.wAdd + " / −" + R.wDel + " / ≈" + R.wChg],
        ["Kalimat — ditambah / dihapus / berubah", "+" + R.sAdd + " / −" + R.sDel + " / ≈" + R.sChg],
        ["Paragraf — ditambah / dihapus / berubah", "+" + R.pAdd + " / −" + R.pDel + " / ≈" + R.pChg],
        ["Paragraf berpindah urutan (isi sama)", String(R.pMoved)],
        ["Jumlah kata — A / B", fmtNumID(R.wordsA) + " / " + fmtNumID(R.wordsB)],
        ["Jumlah kalimat — A / B", fmtNumID(R.sentsA) + " / " + fmtNumID(R.sentsB)],
        ["Jumlah paragraf — A / B", fmtNumID(R.parasA) + " / " + fmtNumID(R.parasB)]
      ]) + (R.changedPairs.length ? "<p style=\"margin-top:10px;\"><strong>Pasangan kalimat yang berubah</strong> (maks 10 ditampilkan):</p>" + R.changedPairs.slice(0, 10).map(function(p){
          return "<p class=\"wf-note\" style=\"margin:6px 0;\"><span class=\"d-badge badge-del\">A</span> " + escapeHtml(p.aText) + "<br /><span class=\"d-badge badge-add\">B</span> " + escapeHtml(p.bText) + "</p>";
        }).join("") : "<p class=\"wf-note\" style=\"margin-top:10px;\">Tidak ada pasangan kalimat yang berubah isinya.</p>");

      var f1 = function(x){ return wfFmt(x, 1); }, f2 = function(x){ return wfFmt(x, 2); }, f3 = function(x){ return wfPctTxt(x); };
      var rowsF = [
        ["Kata unik", fmtNumID(fa.unique), fmtNumID(fb.unique), cmpDeltaTxt(fa.unique, fb.unique, function(v){ return fmtNumID(v); })],
        ["TTR", f3(fa.ttr), f3(fb.ttr), cmpDeltaTxt(fa.ttr, fb.ttr, function(v){ return wfFmt(v * 100) + " poin"; })],
        ["TTR jendela 50 kata", f3(fa.ttrWin), f3(fb.ttrWin), cmpDeltaTxt(fa.ttrWin, fb.ttrWin, function(v){ return wfFmt(v * 100) + " poin"; })],
        ["Hapax (% dari unik)", f3(fa.unique ? fa.hapax / fa.unique : 0), f3(fb.unique ? fb.hapax / fb.unique : 0), cmpDeltaTxt(fa.unique ? fa.hapax / fa.unique : 0, fb.unique ? fb.hapax / fb.unique : 0, function(v){ return wfFmt(v * 100) + " poin"; })],
        ["Indeks Guiraud", f1(fa.guiraud), f1(fb.guiraud), cmpDeltaTxt(fa.guiraud, fb.guiraud, f1)],
        ["Rata-rata kata per kalimat", f1(fa.lensMean), f1(fb.lensMean), cmpDeltaTxt(fa.lensMean, fb.lensMean, f1)],
        ["Median kata per kalimat", f1(fa.lensMedian), f1(fb.lensMedian), cmpDeltaTxt(fa.lensMedian, fb.lensMedian, f1)],
        ["CV ritme kalimat", f2(fa.lensCv), f2(fb.lensCv), cmpDeltaTxt(fa.lensCv, fb.lensCv, f2)],
        ["Koma per kalimat", f2(fa.commasPerSent), f2(fb.commasPerSent), cmpDeltaTxt(fa.commasPerSent, fb.commasPerSent, f2)],
        ["Subordinasi per kalimat", f2(fa.subPerSent), f2(fb.subPerSent), cmpDeltaTxt(fa.subPerSent, fb.subPerSent, f2)],
        ["Kalimat panjang (>25 kata)", f3(fa.longSentPct), f3(fb.longSentPct), cmpDeltaTxt(fa.longSentPct, fb.longSentPct, function(v){ return wfFmt(v * 100) + " poin"; })],
        ["Transisi per 100 kata", f2(fa.transPer100), f2(fb.transPer100), cmpDeltaTxt(fa.transPer100, fb.transPer100, f2)],
        ["Kata isi tersering", fa.topContent.length ? "“" + escapeHtml(fa.topContent[0].w) + "” (" + fa.topContent[0].c + "×)" : "—", fb.topContent.length ? "“" + escapeHtml(fb.topContent[0].w) + "” (" + fb.topContent[0].c + "×)" : "—", "—"],
        ["Pola 4 kata berulang (≥2×)", String(fa.topGrams.length), String(fb.topGrams.length), cmpDeltaTxt(fa.topGrams.length, fb.topGrams.length, function(v){ return String(v); })],
        ["CV konsistensi antarparagraf", f2(fa.cons.cvLen), f2(fb.cons.cvLen), cmpDeltaTxt(fa.cons.cvLen, fb.cons.cvLen, f2)]
      ];
      $("cmp-forensic").innerHTML = "<table class=\"wf-table\"><thead><tr><td>Metrik</td><td style=\"text-align:right;\">Dokumen A</td><td style=\"text-align:right;\">Dokumen B</td><td style=\"text-align:right;\">Selisih (B − A)</td></tr></thead><tbody>" +
        rowsF.map(function(r){ return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td></tr>"; }).join("") + "</tbody></table>";

      var maxD = 1;
      fa.buckets.forEach(function(c, i){ maxD = Math.max(maxD, c, fb.buckets[i]); });
      $("cmp-dist").innerHTML = fa.buckets.map(function(c, i){
        return "<div class=\"cmp-dist-row\"><span>" + fa.bucketLabels[i] + " kata</span><span class=\"cmp-dist-bars\"><span class=\"cmp-dist-fill fill-a\" style=\"width:" + (c / maxD * 100).toFixed(1) + "%\"></span><span class=\"cmp-dist-fill fill-b\" style=\"width:" + (fb.buckets[i] / maxD * 100).toFixed(1) + "%\"></span></span><span>A " + c + " · B " + fb.buckets[i] + " kalimat</span></div>";
      }).join("");

      /* Berdampingan + Inline dengan batas tampilan 6.000 kata per sisi. */
      var usedA = 0, usedB = 0, cut = false;
      var sbsHtml = "", inHtml = "", lastSame = null;
      function flushSame(){
        if(lastSame){ sbsHtml += "<div class=\"cmp-cell\">" + escapeHtml(lastSame.a) + "</div><div class=\"cmp-cell\">" + escapeHtml(lastSame.b) + "</div>"; inHtml += escapeHtml(lastSame.a) + " "; lastSame = null; }
      }
      R.rows.forEach(function(r){
        if(cut) return;
        var wa = r.aText ? wordsOf(r.aText).length : 0, wb = r.bText ? wordsOf(r.bText).length : 0;
        if(usedA + wa > 6000 || usedB + wb > 6000){ cut = true; flushSame(); return; }
        usedA += wa; usedB += wb;
        if(r.kind === "note"){ flushSame(); sbsHtml += "<div class=\"cmp-same-note\" style=\"grid-column:1 / -1;\">" + escapeHtml(r.text) + "</div>"; inHtml += "<div class=\"cmp-same-note\">" + escapeHtml(r.text) + "</div>"; return; }
        if(r.kind === "same"){
          if(lastSame){ lastSame.a += " " + r.aText; lastSame.b += " " + r.bText; }
          else lastSame = { a: r.aText, b: r.bText };
          return;
        }
        flushSame();
        if(r.kind === "removed"){
          sbsHtml += "<div class=\"cmp-cell d-del\"><span class=\"d-badge badge-del\">− HAPUS</span>" + escapeHtml(r.aText) + "</div><div class=\"cmp-cell empty\">— tidak ada di B —</div>";
          inHtml += "<span class=\"sent-del\"><span class=\"d-badge badge-del\">− HAPUS</span>" + escapeHtml(r.aText) + "</span> ";
        } else if(r.kind === "added"){
          sbsHtml += "<div class=\"cmp-cell empty\">— tidak ada di A —</div><div class=\"cmp-cell d-add\"><span class=\"d-badge badge-add\">＋ TAMBAH</span>" + escapeHtml(r.bText) + "</div>";
          inHtml += "<span class=\"sent-add\"><span class=\"d-badge badge-add\">＋ TAMBAH</span>" + escapeHtml(r.bText) + "</span> ";
        } else if(r.kind === "changed"){
          var ha = cmpOpsHtmlA(r.ops), hb = cmpOpsHtmlB(r.ops), hi = cmpOpsHtmlInline(r.ops);
          sbsHtml += "<div class=\"cmp-cell d-chg\"><span class=\"d-badge badge-chg\">≈ BERUBAH</span>" + (ha !== null ? ha : escapeHtml(r.aText)) + "</div><div class=\"cmp-cell d-chg\"><span class=\"d-badge badge-chg\">≈ BERUBAH</span>" + (hb !== null ? hb : escapeHtml(r.bText)) + "</div>";
          inHtml += "<span><span class=\"d-badge badge-chg\">≈ BERUBAH</span>" + (hi !== null ? hi : escapeHtml(r.aText) + " → " + escapeHtml(r.bText)) + "</span> ";
        }
      });
      flushSame();
      $("cmp-sbs").innerHTML = sbsHtml || "<p class=\"wf-note\">Tidak ada baris untuk ditampilkan.</p>";
      $("cmp-inline").innerHTML = inHtml || "<p class=\"wf-note\">Tidak ada teks untuk ditampilkan.</p>";
      var noteTxt = cut ? "Tampilan diff dibatasi 6.000 kata pertama per sisi; seluruh hitungan di atas mencakup teks yang dianalisis penuh." : "";
      $("cmp-sbs-note").textContent = noteTxt;
      $("cmp-inline-note").textContent = noteTxt;
    }
    function cmpSetMode(mode){
      ["an", "sbs", "in"].forEach(function(m){
        $("cmp-view-" + m).hidden = m !== mode;
        $("cmp-tab-" + m).setAttribute("aria-pressed", m === mode ? "true" : "false");
      });
    }
    var cmpTaA = $("cmp-a"), cmpTaB = $("cmp-b");
    function cmpCounters(){
      [["a", cmpTaA], ["b", cmpTaB]].forEach(function(pair){
        var t = pair[1].value;
        $("cmp-" + pair[0] + "-kata").textContent = fmtNumID(wordsOf(t).length);
        $("cmp-" + pair[0] + "-kalimat").textContent = fmtNumID(t.trim() ? splitSentences(t).length : 0);
        $("cmp-" + pair[0] + "-paragraf").textContent = fmtNumID(t.trim() ? splitParagraphs(t).length : 0);
      });
    }
    function cmpShowError(msg){
      var b = $("cmp-error");
      if(msg){ b.innerHTML = msg; b.classList.add("show"); }
      else { b.innerHTML = ""; b.classList.remove("show"); }
    }
    function cmpFileStatus(side, html, kind){
      var el = $("cmp-" + side + "-status");
      el.innerHTML = html;
      el.className = "file-status show" + (kind ? " " + kind : "");
    }
    function cmpRun(){
      cmpShowError("");
      var rawA = cmpTaA.value, rawB = cmpTaB.value;
      if(!rawA.trim() || !rawB.trim()){
        cmpShowError("<strong>Kedua dokumen harus terisi.</strong> Tempel teks atau unggah berkas pada Dokumen A dan Dokumen B terlebih dahulu.");
        return;
      }
      var btn = $("cmp-btn");
      btn.disabled = true;
      btn.textContent = "Membandingkan…";
      setTimeout(function(){
        try {
          var capA = capAnalysisText(rawA), capB = capAnalysisText(rawB);
          if(wordsOf(capA.text).length === 0 || wordsOf(capB.text).length === 0){
            cmpShowError("<strong>Salah satu dokumen tidak memuat kata yang terbaca.</strong> Periksa kembali isinya.");
            return;
          }
          var R = cmpDiff(capA.text, capB.text);
          var fa = wfAnalyze(capA.text), fb = wfAnalyze(capB.text);
          cmpLast = { R: R, fa: fa, fb: fb, cappedA: capA.capped, cappedB: capB.capped, totalA: capA.totalWords, totalB: capB.totalWords };
          histSave("compare", histTitleOf(cmpTaA.value), { similarityPct: Math.round(R.similarity * 1000) / 10, wordsA: capA.totalWords, wordsB: capB.totalWords }, null);
          $("cmp-results").hidden = false;
          cmpRender(R, fa, fb);
          cmpSetMode("an");
          $("cmp-results").scrollIntoView({ behavior: "smooth", block: "start" });
        } finally {
          btn.disabled = false;
          btn.textContent = "Bandingkan";
        }
      }, 30);
    }
    function cmpHandleFile(side, f){
      if(!f) return;
      var ta = side === "a" ? cmpTaA : cmpTaB;
      if(typeof f.size === "number" && f.size > MAX_FILE_BYTES){
        cmpFileStatus(side, "<strong>Berkas terlalu besar</strong> (" + (f.size / 1048576).toFixed(1).replace(".", ",") + " MB) — batasnya 20 MB.", "err");
        return;
      }
      var lower = (f.name || "").toLowerCase();
      if(lower.endsWith(".doc") && !lower.endsWith(".docx")){
        cmpFileStatus(side, "<strong>Format .doc lama tidak didukung</strong> — simpan ulang sebagai .docx, lalu unggah lagi.", "err");
        return;
      }
      var kind = null;
      if(lower.endsWith(".docx")) kind = "docx";
      else if(lower.endsWith(".pdf")) kind = "pdf";
      else if(lower.endsWith(".txt") || f.type === "text/plain") kind = "txt";
      else { cmpFileStatus(side, "<strong>Format berkas belum didukung.</strong> Yang bisa diunggah: .txt, .docx, dan .pdf.", "err"); return; }
      cmpFileStatus(side, "Membaca berkas <span class=\"fname\">" + escapeHtml(f.name) + "</span>…", "");
      var p = kind === "txt" ? f.text() : f.arrayBuffer().then(kind === "docx" ? extractDocxText : extractPdfText);
      p.then(function(text){
        text = String(text || "");
        var wc = wordsOf(text).length;
        if(kind === "pdf" && (wc < 30 || looksGarbled(text))){
          ocrPendingFile = f;
          cmpFileStatus(side, "<strong>Teks dari PDF ini tidak terbaca</strong> — kemungkinan PDF hasil pindai/gambar (butuh OCR) atau font-nya tidak standar. Salin-tempel teksnya langsung, atau <button type=\"button\" class=\"btn-ghost\" data-ocr-open=\"1\">Buka di OCR</button>", "err");
          return;
        }
        if(!text.trim() || wc === 0){ cmpFileStatus(side, "<strong>Tidak ada teks yang bisa dibaca dari berkas ini.</strong>", "err"); return; }
        ta.value = text;
        cmpCounters();
        cmpFileStatus(side, "Berkas dimuat: <span class=\"fname\">" + escapeHtml(f.name) + "</span> — " + fmtNumID(wc) + " kata terbaca.", "ok");
        if(cmpTaA.value.trim() && cmpTaB.value.trim()) cmpRun();
      }).catch(function(){
        cmpFileStatus(side, "<strong>Berkas tidak bisa dibaca.</strong> Pastikan formatnya benar dan berkas tidak rusak, atau salin-tempel teksnya langsung.", "err");
      });
    }
    async function cmpDownloadPdf(){
      var st = $("cmp-pdf-status");
      if(!cmpLast){ st.textContent = "Jalankan perbandingan terlebih dahulu."; return; }
      var btn = $("cmp-pdf");
      btn.disabled = true;
      st.textContent = "Menyiapkan PDF…";
      try {
        var jsPDF = await loadJsPdf();
        var R = cmpLast.R, fa = cmpLast.fa, fb = cmpLast.fb;
        var doc = new jsPDF({ unit: "mm", format: "a4" });
        var W = 210, M = 16, y = 18, lh = 5.6;
        function line(txt, size, bold){
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(size || 10.5);
          var parts = doc.splitTextToSize(pdfSafe(txt), W - 2 * M);
          parts.forEach(function(p){
            if(y > 282){ doc.addPage(); y = 18; }
            doc.text(p, M, y);
            y += lh;
          });
        }
        function gap(mm){ y += (mm || 3); }
        line("Saksara — Laporan Perbandingan Dokumen (Bandingkan Tulisan)", 14, true);
        line("Dibuat lokal di peramban pada " + new Date().toLocaleString("id-ID") + ". Laporan ini deskriptif: kemiripan bukan bukti kepengarangan dan perubahan karakteristik bukan bukti AI.", 9.5);
        gap(2);
        line("RINGKASAN", 11.5, true);
        line("Kemiripan tekstual (Dice): " + wfFmt(R.similarity * 100) + "%");
        line("Kata: A " + fmtNumID(R.wordsA) + " | B " + fmtNumID(R.wordsB) + " | ditambah +" + R.wAdd + " | dihapus -" + R.wDel + " | berubah ~" + R.wChg);
        line("Kalimat: A " + R.sentsA + " | B " + R.sentsB + " | ditambah +" + R.sAdd + " | dihapus -" + R.sDel + " | berubah ~" + R.sChg);
        line("Paragraf: A " + R.parasA + " | B " + R.parasB + " | ditambah +" + R.pAdd + " | dihapus -" + R.pDel + " | berubah ~" + R.pChg + " | berpindah urutan " + R.pMoved);
        gap(2);
        line("PASANGAN KALIMAT YANG BERUBAH (maks 15)", 11.5, true);
        if(R.changedPairs.length){
          R.changedPairs.slice(0, 15).forEach(function(p, i){
            line((i + 1) + ". A: " + p.aText.slice(0, 220));
            line("   B: " + p.bText.slice(0, 220));
          });
        } else line("Tidak ada pasangan kalimat yang berubah isinya.");
        gap(2);
        line("METRIK WRITING FORENSIC (A -> B)", 11.5, true);
        [["TTR", wfPctTxt(fa.ttr), wfPctTxt(fb.ttr)], ["TTR jendela", wfPctTxt(fa.ttrWin), wfPctTxt(fb.ttrWin)], ["Guiraud", wfFmt(fa.guiraud), wfFmt(fb.guiraud)], ["Rata-rata kata/kalimat", wfFmt(fa.lensMean), wfFmt(fb.lensMean)], ["CV ritme", wfFmt(fa.lensCv, 2), wfFmt(fb.lensCv, 2)], ["Transisi per 100 kata", wfFmt(fa.transPer100, 2), wfFmt(fb.transPer100, 2)]].forEach(function(r){
          line(r[0] + ": " + r[1] + " -> " + r[2]);
        });
        gap(2);
        line("METODOLOGI", 11.5, true);
        line("Kata dibandingkan dalam bentuk ternormalisasi (huruf kecil, tanpa tanda baca). Penjajaran tiga tingkat: paragraf identik dicocokkan lebih dulu (yang urutannya berbeda dilaporkan sebagai berpindah urutan), sisa paragraf dipasangkan menurut posisi, kalimat dijajarkan dengan cara yang sama, dan kata di dalam pasangan kalimat berubah dibandingkan dengan diff LCS. Kemiripan = koefisien Dice: 2 x kata-cocok / (kata-A + kata-B). Metrik karakteristik dihitung dengan fungsi Writing Forensic Saksara.");
        gap(1);
        line("KETERBATASAN", 11.5, true);
        line("Kemiripan tinggi tidak membuktikan penulis yang sama; kemiripan rendah tidak membuktikan penulis berbeda. Parafrase menyeluruh menghasilkan kemiripan tekstual rendah walau maknanya sama. Perubahan karakteristik antarversi adalah deskripsi statistik, bukan bukti AI dan bukan bukti mengakali deteksi. Dokumen pendek membuat persentase mudah berayun. Analisis dibatasi 100.000 kata per dokumen.");
        doc.save("saksara-perbandingan.pdf");
        st.textContent = "PDF terunduh.";
      } catch(e) {
        st.textContent = "PDF gagal dibuat — pustaka PDF tidak termuat (periksa koneksi internet) atau terjadi kesalahan.";
      } finally {
        btn.disabled = false;
      }
    }
    if(cmpTaA && cmpTaB){
      cmpTaA.addEventListener("input", cmpCounters);
      cmpTaB.addEventListener("input", cmpCounters);
      $("cmp-btn").addEventListener("click", cmpRun);
      $("cmp-swap").addEventListener("click", function(){
        var v = cmpTaA.value; cmpTaA.value = cmpTaB.value; cmpTaB.value = v;
        cmpCounters();
        $("cmp-results").hidden = true;
        cmpShowError("");
      });
      $("cmp-clear").addEventListener("click", function(){
        cmpTaA.value = ""; cmpTaB.value = "";
        cmpCounters(); cmpShowError("");
        $("cmp-results").hidden = true;
        ["a", "b"].forEach(function(s){ var el = $("cmp-" + s + "-status"); el.innerHTML = ""; el.className = "file-status"; });
      });
      $("cmp-clear-a").addEventListener("click", function(){ cmpTaA.value = ""; cmpCounters(); cmpTaA.focus(); });
      $("cmp-clear-b").addEventListener("click", function(){ cmpTaB.value = ""; cmpCounters(); cmpTaB.focus(); });
      $("cmp-file-a").addEventListener("change", function(ev){ if(ev.target.files && ev.target.files[0]) cmpHandleFile("a", ev.target.files[0]); ev.target.value = ""; });
      $("cmp-file-b").addEventListener("change", function(ev){ if(ev.target.files && ev.target.files[0]) cmpHandleFile("b", ev.target.files[0]); ev.target.value = ""; });
      $("cmp-ex").addEventListener("click", function(){
        var b = CONTOH_AI
          .replace("berkembang sangat pesat", "berkembang begitu pesat")
          .replace("Dengan demikian, penting untuk dicatat bahwa teknologi memberikan kemudahan akses informasi bagi masyarakat di berbagai daerah. ", "")
          .replace("di berbagai jenjang pendidikan formal.", "di berbagai jenjang pendidikan formal. Oleh sebab itu, sekolah perlu menyiapkan pelatihan literasi digital bagi guru secara berkala.");
        cmpTaA.value = CONTOH_AI;
        cmpTaB.value = b;
        cmpCounters();
        cmpRun();
      });
      $("cmp-tab-an").addEventListener("click", function(){ cmpSetMode("an"); });
      $("cmp-tab-sbs").addEventListener("click", function(){ cmpSetMode("sbs"); });
      $("cmp-tab-in").addEventListener("click", function(){ cmpSetMode("in"); });
      $("cmp-pdf").addEventListener("click", cmpDownloadPdf);
      cmpCounters();
    }

    /* ---------- Phase 2: aktivitas dashboard (hanya memori sesi — tanpa penyimpanan) ---------- */
    var dashRuns = 0, dashLast = null, dashBatch = null, dashCountedRun = -1;
    function dashBandLabel(p){
      if(p < 35) return "Indikasi AI rendah";
      if(p <= 65) return "Sebagian mirip pola AI — perlu diperiksa lebih lanjut";
      return "Indikasi AI tinggi";
    }
    function dashClock(){
      try{ return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
      catch(e){ return ""; }
    }
    function renderDash(){
      var box = $("dash-activity");
      if(box){
        if(!dashLast && !dashBatch){
          box.innerHTML = "<p class=\"dash-empty\">Belum ada analisis pada sesi ini. Jalankan analisis pertama Anda di <a href=\"#/detector\">Detector</a> — ringkasannya akan tampil di sini. Aktivitas ini hanya hidup selama tab ini terbuka; tidak ada yang disimpan atau dikirim ke mana pun.</p>";
        } else {
          var html = "";
          if(dashLast){
            html += "<p class=\"dash-last\"><span class=\"dash-score\">" + dashLast.pct + "%</span> — " + dashBandLabel(dashLast.pct) +
              "<span class=\"dash-meta\">Analisis terakhir · " + dashLast.words + " kata · " + dashLast.sents + " kalimat · pukul " + dashLast.time + "</span></p>";
          }
          if(dashBatch){
            html += "<p class=\"dash-last\">Batch terakhir: <strong>" + dashBatch.count + " berkas</strong> diproses.<span class=\"dash-meta\">Pukul " + dashBatch.time + "</span></p>";
          }
          html += "<p class=\"dash-meta\">Total analisis tunggal sesi ini: " + dashRuns + " · Hanya di memori tab ini — tidak disimpan.</p>";
          box.innerHTML = html;
        }
      }
      var cs = $("dash-clf-state");
      if(cs){
        cs.textContent = clfState === "ready" ? "Aktif — siap memperkuat skor" :
          clfState === "loading" ? "Sedang dimuat…" :
          clfState === "error" ? "Gagal dimuat (heuristik tetap bekerja penuh)" : "Belum diaktifkan";
      }
      var cc = $("dash-clf-cache");
      if(cc){ cc.textContent = clfCacheExists ? "Sudah tersimpan — pengaktifan berikutnya tanpa unduhan" : "Belum tersimpan"; }
    }
    function dashTrackScore(finalPct){
      if(!lastResult) return;
      if(dashCountedRun !== analysisRunSeq){
        dashCountedRun = analysisRunSeq;
        dashRuns++;
        dashLast = { pct: finalPct, words: lastResult.words, sents: lastResult.sents.length, time: dashClock() };
      } else if(dashLast){
        dashLast.pct = finalPct;
      }
      renderDash();
    }
    function noteDashBatch(count){
      dashBatch = { count: count, time: dashClock() };
      renderDash();
    }
    window.addEventListener("hashchange", renderDash);
    renderDash();
    setTimeout(renderDash, 1500);


  /* ================= Phase 5: Benchmark Center =================
     Data: BN_SAMPLES = 18 teks regresi + skor classifier offline berprovenans;
     BN_V0 = agregat evaluasi v0 (evaluate-v0.cjs, 20 Nov 2026). Mesin metrik
     murni di antara penanda EVAL-CORE; tidak ada angka yang dikarang — nilai
     yang tidak terdefinisi ditampilkan apa adanya. */
  var BN_SAMPLES = [{"id":"ai-01-teknologi-pendidikan","cat":"ai","label":"ai","clf":1,"text":"Di era digital yang berkembang pesat, teknologi informasi memainkan peran penting dalam dunia pendidikan modern. Selain itu, perkembangan teknologi yang pesat telah mengubah cara guru mengajar dan siswa belajar di kelas. Dengan demikian, penting untuk dicatat bahwa pemanfaatan teknologi secara tepat dapat meningkatkan kualitas pembelajaran secara keseluruhan.\n\nSelain itu, teknologi memberikan akses yang luas terhadap berbagai sumber belajar berkualitas bagi siswa di seluruh Indonesia. Dalam hal ini, siswa dapat mempelajari materi dari berbagai platform pembelajaran daring yang tersedia secara gratis maupun berbayar. Hal ini menunjukkan bahwa teknologi mampu menjembatani kesenjangan akses pendidikan antara daerah perkotaan dan daerah terpencil di Indonesia.\n\nDi sisi lain, pemanfaatan teknologi dalam pendidikan juga menghadirkan tantangan dan peluang yang perlu diperhatikan bersama. Tidak hanya memudahkan proses belajar, tetapi juga menuntut kesiapan guru dalam menguasai perangkat dan platform digital yang digunakan. Oleh karena itu, pelatihan literasi digital bagi guru merupakan salah satu aspek penting yang harus diprioritaskan oleh pemerintah dan sekolah.\n\nSecara keseluruhan, teknologi merupakan salah satu faktor kunci dalam meningkatkan mutu pendidikan di Indonesia apabila dimanfaatkan secara bijak. Pada akhirnya, keberhasilan integrasi teknologi dalam pendidikan bergantung pada kerja sama semua pihak, mulai dari pemerintah, sekolah, guru, siswa, hingga masyarakat. Tidak dapat dipungkiri bahwa perkembangan teknologi akan terus membawa perubahan besar bagi dunia pendidikan. Kesimpulannya, dapat disimpulkan bahwa teknologi harus dimanfaatkan secara optimal demi terwujudnya pendidikan yang berkualitas bagi generasi masa depan bangsa.\n","golden":0.674},{"id":"ai-02-media-sosial","cat":"ai","label":"ai","clf":1,"text":"Media sosial merupakan salah satu fenomena yang paling berpengaruh dalam kehidupan masyarakat modern, khususnya di kalangan remaja. Di era digital ini, media sosial memainkan peran penting dalam cara remaja berkomunikasi, belajar, dan mengekspresikan diri setiap harinya. Selain itu, media sosial juga memberikan ruang bagi remaja untuk membangun jaringan pertemanan yang luas tanpa batas geografis.\n\nDalam hal ini, media sosial memberikan berbagai manfaat positif bagi perkembangan remaja apabila digunakan secara bijak dan bertanggung jawab. Remaja dapat mengakses informasi dan pengetahuan baru dengan cepat melalui berbagai platform yang tersedia saat ini. Selain itu, media sosial juga dapat menjadi sarana untuk mengembangkan kreativitas serta menyalurkan minat dan bakat yang dimiliki oleh setiap remaja.\n\nNamun demikian, penggunaan media sosial yang berlebihan juga dapat menimbulkan dampak negatif yang cukup serius bagi kesehatan mental remaja. Dengan kata lain, remaja yang terlalu lama menghabiskan waktu di media sosial berisiko mengalami kecemasan, gangguan tidur, dan menurunnya prestasi belajar di sekolah. Oleh karena itu, peran orang tua dan guru sangat diperlukan untuk membimbing remaja dalam menggunakan media sosial secara sehat dan seimbang.\n\nSecara keseluruhan, media sosial merupakan pedang bermata dua yang membawa manfaat sekaligus risiko bagi kehidupan remaja modern. Pada akhirnya, kunci utama terletak pada kesadaran dan kedewasaan setiap individu dalam memanfaatkan teknologi tersebut. Kesimpulannya, dapat disimpulkan bahwa penggunaan media sosial yang bijak akan memberikan dampak positif, sedangkan penggunaan yang berlebihan akan menimbulkan berbagai permasalahan bagi remaja.\n","golden":0.6159},{"id":"ai-03-lingkungan","cat":"ai","label":"ai","clf":1,"text":"Lingkungan hidup merupakan salah satu aspek penting yang menentukan keberlangsungan kehidupan manusia di bumi. Seiring dengan perkembangan zaman, kondisi lingkungan hidup di berbagai belahan dunia mengalami penurunan kualitas yang cukup mengkhawatirkan. Oleh karena itu, menjaga kelestarian lingkungan merupakan tanggung jawab bersama yang harus dilakukan oleh seluruh lapisan masyarakat.\n\nDalam konteks ini, kerusakan lingkungan disebabkan oleh berbagai faktor, antara lain sebagai berikut: penebangan hutan secara liar, pencemaran air dan udara, serta penggunaan plastik yang berlebihan dalam kehidupan sehari-hari. Selain itu, perubahan iklim yang terjadi akibat pemanasan global juga memberikan dampak yang sangat besar terhadap keseimbangan ekosistem di bumi. Hal ini dikarenakan aktivitas manusia yang tidak ramah lingkungan terus meningkat dari waktu ke waktu.\n\nDalam rangka meningkatkan kesadaran masyarakat, berbagai upaya pelestarian lingkungan perlu dilakukan secara berkelanjutan dan terencana dengan baik. Pemerintah diharapkan dapat membuat kebijakan yang tegas mengenai perlindungan lingkungan hidup di Indonesia. Selain itu, masyarakat juga perlu berperan dalam menjaga lingkungan, misalnya dengan mengurangi penggunaan plastik dan menanam pohon di sekitar tempat tinggal masing-masing.\n\nKesimpulannya, kesimpulan yang dapat diambil adalah menjaga kelestarian lingkungan hidup merupakan kewajiban setiap manusia demi masa depan generasi yang akan datang. Secara umum, dapat dikatakan bahwa lingkungan yang lestari akan memberikan manfaat yang besar bagi kehidupan manusia. Oleh karena itu, marilah kita bersama-sama menjaga dan melestarikan lingkungan hidup mulai dari diri sendiri dan dari hal-hal kecil di sekitar kita.\n","golden":0.6248},{"id":"ai-04-kesehatan-mental","cat":"ai","label":"ai","clf":1,"text":"Kesehatan mental merupakan salah satu aspek penting yang perlu diperhatikan dalam kehidupan mahasiswa di lingkungan perguruan tinggi. Di era modern ini, mahasiswa menghadapi berbagai tekanan, baik dari segi akademik, ekonomi, maupun sosial yang cukup kompleks. Selain itu, tuntutan untuk berprestasi sering kali membuat mahasiswa mengabaikan kondisi kesehatan mental mereka sendiri.\n\nDalam hal ini, tekanan akademik yang tinggi dapat memicu stres, kecemasan, bahkan depresi pada mahasiswa apabila tidak dikelola dengan baik. Dengan demikian, penting untuk dicatat bahwa kesehatan mental yang terganggu dapat berdampak pada menurunnya prestasi akademik serta kualitas hidup mahasiswa secara keseluruhan. Hal ini menunjukkan bahwa perhatian terhadap kesehatan mental sama pentingnya dengan perhatian terhadap kesehatan fisik yang selama ini lebih sering diperhatikan.\n\nOleh karena itu, berbagai pihak perlu berperan dalam menjaga kesehatan mental mahasiswa di lingkungan kampus secara bersama-sama. Perguruan tinggi perlu menyediakan layanan konseling yang mudah diakses oleh seluruh mahasiswa yang membutuhkannya. Selain itu, mahasiswa juga perlu membangun kebiasaan hidup yang sehat, seperti berolahraga secara teratur, beristirahat dengan cukup, dan menjaga hubungan sosial yang positif dengan lingkungan sekitarnya.\n\nSecara keseluruhan, kesehatan mental merupakan fondasi penting bagi keberhasilan mahasiswa dalam menjalani pendidikan dan kehidupan di masa depan. Pada akhirnya, kesadaran akan pentingnya kesehatan mental harus terus ditingkatkan di kalangan mahasiswa dan seluruh sivitas akademika. Kesimpulannya, dapat disimpulkan bahwa menjaga kesehatan mental merupakan investasi jangka panjang yang sangat berharga bagi setiap mahasiswa.\n","golden":0.6281},{"id":"ai-05-ekonomi-digital","cat":"ai","label":"ai","clf":1,"text":"Ekonomi digital merupakan salah satu sektor yang mengalami perkembangan paling pesat dalam beberapa tahun terakhir di Indonesia. Seiring dengan perkembangan teknologi, berbagai aktivitas ekonomi kini beralih ke platform digital yang lebih efisien dan praktis. Selain itu, ekonomi digital juga membuka peluang yang sangat luas bagi para pelaku usaha mikro, kecil, dan menengah di seluruh Indonesia.\n\nDalam konteks ini, pelaku UMKM dapat memasarkan produk mereka ke pasar yang jauh lebih luas tanpa harus memiliki toko fisik. Dengan demikian, biaya operasional dapat ditekan dan keuntungan yang diperoleh menjadi lebih besar dari sebelumnya. Hal ini dikarenakan platform digital menyediakan berbagai fitur yang memudahkan proses promosi, transaksi, dan pengiriman barang kepada konsumen di berbagai daerah.\n\nDi sisi lain, perkembangan ekonomi digital juga menghadirkan tantangan yang perlu dihadapi oleh para pelaku UMKM di Indonesia. Tidak hanya persaingan yang semakin ketat, tetapi juga tuntutan untuk menguasai teknologi digital menjadi kendala bagi sebagian pelaku usaha. Oleh karena itu, pemerintah diharapkan dapat memberikan pelatihan dan pendampingan agar para pelaku UMKM mampu beradaptasi dengan perkembangan zaman yang semakin cepat.\n\nKesimpulannya, ekonomi digital memberikan kontribusi nyata yang sangat besar bagi pertumbuhan ekonomi nasional apabila dimanfaatkan secara optimal. Secara umum, dapat dikatakan bahwa transformasi digital merupakan keniscayaan yang tidak dapat dihindari oleh para pelaku usaha. Oleh karena itu, seluruh pihak perlu bekerja sama agar ekonomi digital dapat berkembang secara inklusif dan memberikan manfaat bagi seluruh masyarakat Indonesia.\n","golden":0.6499},{"id":"ap-01-teknologi-pendidikan","cat":"ap","label":"ai","clf":0,"text":"Kelas-kelas sekarang tidak lagi bergantung pada papan tulis dan kapur. Hampir semua guru yang saya amati membawa laptop, membuka video, lalu membagikan tautan materi ke grup WhatsApp kelas sebelum pelajaran dimulai. Murid pun berubah. Mereka mencari penjelasan tambahan di YouTube ketika rumus di buku paket terasa membingungkan, mengerjakan kuis lewat aplikasi, dan mengumpulkan tugas dari rumah tanpa perlu mencetak apa pun.\n\nAkses adalah perubahan yang paling terasa. Seorang siswa di kabupaten yang jauh dari kota bisa menonton penjelasan guru terbaik dari Jakarta pada malam yang sama, gratis, cukup bermodal ponsel dan sinyal yang kadang timbul tenggelam. Rekaman kuliah, bank soal, sampai simulasi laboratorium tersedia terbuka. Kesenjangan memang belum hilang — kuota tetap mahal bagi sebagian keluarga — tetapi jarak antara sekolah kota dan sekolah desa tidak lagi selebar sepuluh tahun lalu.\n\nMasalahnya, perangkat tidak otomatis membuat orang pandai memakainya. Banyak guru senior gagap membagikan layar. Ada sekolah yang punya laboratorium komputer lengkap tetapi pintunya dikunci rapat karena takut rusak. Pelatihan untuk guru sering hanya sehari, sesudah itu selesai, padahal kebutuhan di kelas muncul setiap minggu. Tanpa pendampingan yang berkelanjutan, teknologi hanya jadi pajangan di laporan akreditasi.\n\nKalau direnungkan, alat hanyalah alat. Hasil akhirnya ditentukan oleh orang-orang yang menggunakannya: pemerintah yang menyediakan infrastruktur, kepala sekolah yang berani membuka pintu laboratorium, guru yang mau belajar lagi, dan siswa yang tidak sekadar menonton video sambil lalu. Teknologi sudah membuka pintu yang dulu terkunci. Apakah kita benar-benar masuk, itu soal lain.\n","golden":0.1615},{"id":"ap-02-media-sosial","cat":"ap","label":"ai","clf":0,"text":"Instagram, TikTok, dan WhatsApp sudah seperti halaman rumah kedua bagi remaja. Bangun tidur, yang dibuka pertama kali bukan buku, melainkan notifikasi. Di sana mereka mengobrol, memamerkan foto, mencari hiburan, dan — jangan salah — juga belajar banyak hal yang tidak diajarkan di kelas, dari tutorial menggambar sampai penjelasan soal fisika dalam video enam puluh detik.\n\nSisi baiknya nyata. Remaja pemalu yang sulit bicara di depan kelas bisa menemukan komunitas yang menerima minat anehnya, misalnya kelompok pecinta astronomi amatir. Informasi menyebar cepat. Ketika ada bencana, penggalangan bantuan sering bergerak lebih dulu lewat media sosial ketimbang lewat pengumuman resmi.\n\nTetapi ada harga yang dibayar. Tidur yang terpotong karena menggulir layar sampai lewat tengah malam. Perbandingan tanpa henti dengan hidup orang lain yang tampak selalu lebih seru, lebih cantik, lebih kaya. Nilai yang merosot pelan-pelan tanpa terasa. Beberapa penelitian mengaitkan pemakaian berlebihan dengan kecemasan, dan siapa pun yang pernah melihat remaja panik karena ponselnya tertinggal pasti paham bahwa kaitan itu bukan sekadar angka di jurnal.\n\nJalan tengahnya bukan melarang. Larangan total jarang berhasil dan sering hanya memindahkan aktivitas itu ke tempat yang lebih tersembunyi. Yang lebih masuk akal: aturan yang jelas di rumah, jam tanpa gawai, dan orang tua yang memberi contoh, bukan hanya memberi perintah. Remaja meniru jauh lebih cepat daripada mendengar.\n","golden":0.1597},{"id":"ap-03-lingkungan","cat":"ap","label":"ai","clf":0,"text":"Sungai di belakang kompleks kami berubah warna hampir setiap minggu. Kadang cokelat pekat, kadang kehijauan, sesekali berbau menyengat setelah hujan besar. Warga sudah terbiasa. Padahal sungai yang sama, dua puluh tahun lalu, masih dipakai anak-anak untuk berenang sepulang sekolah.\n\nPenyebabnya bukan satu. Pabrik kecil membuang limbah cair tanpa diolah karena memasang instalasi pengolahan itu mahal. Hutan di daerah hulu ditebang dan diganti kebun yang tanahnya mudah longsor. Di rumah-rumah, plastik sekali pakai menumpuk: kantong belanja, botol minuman, kemasan mi instan. Semua berakhir di tempat yang sama — aliran air dan tanah yang pelan-pelan jenuh.\n\nPemerintah sebenarnya tidak diam. Ada aturan, ada sanksi, ada program penanaman pohon yang fotonya selalu bagus di media sosial. Masalahnya ada di penegakan dan kesinambungan. Pohon ditanam seribu batang pada hari peringatan, lalu tidak ada yang tahu berapa yang masih hidup enam bulan kemudian. Pabrik yang ketahuan membuang limbah cukup membayar denda yang besarnya tidak sebanding dengan keuntungan yang mereka selamatkan.\n\nPerubahan yang bertahan lama biasanya justru mulai dari hal remeh. Membawa botol minum sendiri. Menolak kantong plastik. Memilah sampah organik dari yang lain. Hal-hal kecil itu memang tidak menyelamatkan sungai dalam semalam, tetapi ia mengubah cara orang memandang lingkungannya — dari sesuatu yang bisa dipakai habis, menjadi sesuatu yang dititipkan ke anak cucu.\n","golden":0.1925},{"id":"ap-04-kesehatan-mental","cat":"ap","label":"ai","clf":0.0001,"text":"Semester tujuh adalah masa ketika banyak mahasiswa mulai tidur tidak teratur. Skripsi menumpuk. Sebagian sambil bekerja paruh waktu, sebagian lagi memikirkan biaya semester depan yang belum tentu ada. Dari luar semuanya tampak baik-baik saja; di dalam, kepala penuh.\n\nTekanan itu tidak selalu terlihat sebagai tangisan. Kadang bentuknya justru mati rasa: bangun pagi tanpa semangat, menunda semua hal, menghindari pesan dari dosen pembimbing berminggu-minggu. Ada juga yang tetap berprestasi tetapi mengorbankan tidur dan makan, sampai suatu hari tubuhnya yang berhenti lebih dulu. Seorang teman saya sampai mengambil cuti satu semester karena tidak sanggup lagi, dan belakangan saya pikir keputusannya itu justru yang paling sehat di antara kami semua. Kampus sering baru menyadari ada masalah ketika mahasiswa sudah di titik paling bawah.\n\nLayanan konseling sebenarnya tersedia di banyak universitas, tetapi antreannya panjang dan stigma masih kuat. Datang ke psikolog kampus masih dianggap tanda tidak kuat iman atau kurang bersyukur oleh sebagian orang. Padahal patah tulang saja orang tidak malu ke dokter. Kepala yang lelah seharusnya diperlakukan sama wajarnya.\n\nYang bisa dilakukan mahasiswa sendiri tidak rumit, meski tidak selalu mudah. Tidur cukup. Bergerak, walau hanya berjalan kaki keliling kampus. Punya satu dua orang yang bisa diajak bicara tanpa perlu berpura-pura kuat. Dan yang paling sulit: mengakui lebih awal bahwa dirinya sedang tidak baik-baik saja, sebelum semuanya menumpuk jadi satu.\n","golden":0.216},{"id":"hf-01-majapahit","cat":"hf","label":"human","clf":1,"text":"Majapahit adalah sebuah kemaharajaan talasokrasi Hindu-Buddha Jawa yang berbasis di pulau Jawa, sekarang di Indonesia. Pada masa kejayaannya, setelah melakukan ekspansi militer yang signifikan, wilayah Majapahit dan negara-negara bawahannya meliputi hampir seluruh kepulauan Nusantara dan meliputi sebagian Asia Tenggara. Setelah perang saudara yang melemahkan kendali atas negara-negara bawahan, Majapahit perlahan-lahan akhirnya runtuh pada tahun 1527 akibat invasi Kesultanan Demak. Kejatuhan Majapahit menandai munculnya kerajaan-kerajaan Islam di Jawa.\n\nDidirikan oleh Raden Wijaya pada tahun 1292, Majapahit bangkit berkuasa setelah invasi Mongol ke Jawa dan mencapai puncaknya pada era ratu Tribhuwana Wijayatunggadewi dan putranya Hayam Wuruk, yang pemerintahannya pada pertengahan abad ke-14 ditandai dengan penaklukan yang meluas ke seluruh Asia Tenggara. Menurut Nagarakertagama yang ditulis pada tahun 1365, Majapahit adalah sebuah kerajaan dengan 98 wilayah kekuasaan, yang membentang dari Sumatra hingga Papua, termasuk wilayah-wilayah di Indonesia, Singapura, Malaysia, Brunei, Thailand selatan, Timor Leste, dan Filipina barat daya, khususnya Kepulauan Sulu. Sifat hubungan dan pengaruh Majapahit terhadap negara-negara pengikutnya di seberang lautan adalah bersifat mandala, yaitu setiap kerajaan bawahan harus mengirim upeti setiap tahun dan mengakui kekuasaan pusat, namun kerajaan bawahan bebas mempunyai raja dan budaya sendiri.\n\nMajapahit merupakan salah satu kerajaan Hindu-Buddha terakhir di wilayah tersebut dan dianggap sebagai salah satu kerajaan terbesar dan terkuat dalam sejarah Indonesia dan Asia Tenggara. Kadang-kadang Majapahit dianggap sebagai preseden batas wilayah Indonesia modern. Pengaruhnya diperkirakan melampaui wilayah Indonesia modern dan telah menjadi subjek banyak penelitian.\n\nSejarah mengenai kemaharajaan Majapahit masih menjadi salah satu subjek penelitian yang menarik untuk dibahas dan ditelusuri lebih jauh lagi. Sumber utama yang digunakan oleh para sejarawan di antaranya adalah Pararaton (Kitab Raja-raja) dalam bahasa Kawi dan Nagarakertagama dalam bahasa Jawa Kuno. Pararaton menceritakan Ken Arok, pendiri Kerajaan Singhasari, tetapi juga memuat beberapa bagian pendek mengenai terbentuknya Majapahit. Sementara itu, Nagarakertagama adalah puisi Jawa Kuno yang ditulis pada masa keemasan Majapahit di bawah pemerintahan Hayam Wuruk. Kakawin Nagarakertagama pada tahun 2008 diakui sebagai bagian dalam Warisan Ingatan Dunia oleh UNESCO. Selain itu, terdapat beberapa prasasti dalam bahasa Jawa Kuno maupun catatan sejarah dari Tiongkok dan negara-negara lain.\n","golden":0.296},{"id":"hf-02-fotosintesis","cat":"hf","label":"human","clf":0.9917,"text":"Fotosintesis adalah suatu proses biokimia pembentukan karbohidrat dari bahan anorganik yang dilakukan oleh tumbuhan, terutama tumbuhan yang mengandung zat hijau daun, yaitu klorofil. Selain yang mengandung zat hijau daun, ada juga makhluk hidup yang berfotosintesis yaitu alga, dan beberapa jenis bakteri dengan menggunakan zat hara, karbon dioksida, dan air serta dibutuhkan bantuan energi cahaya matahari.\n\nHampir semua makhluk hidup bergantung pada energi yang dihasilkan dalam proses fotosintesis. Akibatnya, fotosintesis menjadi sangat penting bagi kehidupan di bumi. Fotosintesis juga berjasa menghasilkan sebagian besar oksigen yang terdapat di atmosfer bumi. Organisme yang menghasilkan energi melalui fotosintesis disebut sebagai fototrof. Fotosintesis merupakan salah satu cara asimilasi karbon karena dalam fotosintesis karbon bebas dari CO2 diikat (difiksasi) menjadi gula sebagai molekul penyimpan energi. Cara lain yang ditempuh organisme untuk mengasimilasi karbon adalah melalui kemosintesis, yang dilakukan oleh sejumlah bakteri belerang.\n\nMeskipun ada langkah-langkah dalam fotosintesis yang masih belum dipahami, persamaan umum fotosintesis telah diketahui sejak tahun 1800-an. Pada awal tahun 1600-an, seorang dokter dan ahli kimia, Jan van Helmont, melakukan percobaan untuk mengetahui faktor apa yang menyebabkan massa tumbuhan bertambah dari waktu ke waktu. Dari penelitiannya, Helmont menyimpulkan bahwa massa tumbuhan bertambah hanya karena pemberian air. Namun, pada tahun 1727, ahli botani Inggris, Stephen Hales, berhipotesis bahwa pasti ada faktor lain selain air yang berperan. Ia mengemukakan bahwa sebagian makanan tumbuhan berasal dari atmosfer dan cahaya yang terlibat dalam proses tertentu.\n\nPada tahun 1771, Joseph Priestley, seorang ahli kimia sekaligus pendeta berkebangsaan Inggris, menemukan bahwa ketika ia menutupi sebuah lilin menyala dengan sebuah toples terbalik, nyalanya akan mati sebelum lilinnya habis terbakar. Ia kemudian menemukan bila ia meletakkan tikus dalam toples terbalik bersama lilin, tikus itu akan mati lemas. Dari kedua percobaan itu, Priestley menyimpulkan bahwa nyala lilin telah merusak udara dalam toples itu dan menyebabkan matinya tikus. Ia kemudian menunjukkan bahwa udara yang telah dirusak oleh lilin tersebut dapat dipulihkan oleh tumbuhan.\n\nProses fotosintesis tidak dapat berlangsung pada setiap sel, tetapi hanya pada sel yang mengandung pigmen fotosintetik. Sel yang tidak mempunyai pigmen fotosintetik ini tidak mampu melakukan proses fotosintesis. Di dalam daun terdapat mesofil yang terdiri atas jaringan bunga karang dan jaringan pagar. Pada kedua jaringan ini, terdapat kloroplas yang mengandung pigmen hijau klorofil. Pigmen ini merupakan salah satu dari pigmen fotosintesis yang berperan penting dalam menyerap energi matahari.\n","golden":0.3006},{"id":"hf-03-borobudur","cat":"hf","label":"human","clf":1,"text":"Candi Borobudur adalah sebuah candi Buddha yang terletak di Borobudur, Magelang, Jawa Tengah, Indonesia. Candi ini terletak kurang lebih 100 km di sebelah barat daya Semarang, 86 km di sebelah barat Surakarta, dan 40 km di sebelah barat laut Yogyakarta. Candi dengan banyak stupa ini didirikan oleh para penganut agama Buddha Mahayana sekitar tahun 800-an Masehi pada masa pemerintahan wangsa Syailendra, dan diperkirakan baru rampung sekitar tahun 825 M. Borobudur adalah candi atau kuil Buddha terbesar di dunia, sekaligus salah satu monumen Buddha terbesar di dunia.\n\nMonumen ini terdiri atas enam teras berbentuk bujur sangkar yang di atasnya terdapat tiga pelataran melingkar, pada dindingnya dihiasi dengan 2.672 panel relief dan aslinya terdapat 504 arca Buddha. Borobudur memiliki koleksi relief Buddha terlengkap dan terbanyak di dunia. Monumen ini merupakan model alam semesta dan dibangun sebagai tempat suci untuk memuliakan Buddha sekaligus berfungsi sebagai tempat ziarah untuk menuntun umat manusia beralih dari alam nafsu duniawi menuju pencerahan dan kebijaksanaan sesuai ajaran Buddha.\n\nMenurut bukti-bukti sejarah, Borobudur ditinggalkan pada abad ke-14 seiring melemahnya pengaruh kerajaan Hindu dan Buddha di Jawa serta mulai masuknya pengaruh Islam. Dunia mulai menyadari keberadaan bangunan ini sejak ditemukan pada tahun 1814 oleh Sir Thomas Stamford Raffles, yang saat itu menjabat sebagai Gubernur Jenderal Inggris atas Jawa. Nama Borobudur pertama kali ditulis dalam buku Sejarah Pulau Jawa karya Raffles.\n\nProyek pemugaran terbesar digelar pada kurun waktu 1975 hingga 1982 atas upaya Pemerintah Republik Indonesia dan UNESCO, kemudian situs bersejarah ini masuk dalam daftar Situs Warisan Dunia. Borobudur kini masih digunakan sebagai tempat ziarah keagamaan; tiap tahun umat Buddha yang datang dari seluruh Indonesia dan mancanegara berkumpul di Borobudur untuk memperingati Trisuci Waisak. Dalam dunia pariwisata, Borobudur adalah objek wisata tunggal di Indonesia yang paling banyak dikunjungi wisatawan. Pada 11 Februari 2022, pemerintah meresmikan status Candi Borobudur kembali sebagai tempat peribadatan umat Buddha di Indonesia dan dunia.\n","golden":0.3128},{"id":"hf-04-demokrasi","cat":"hf","label":"human","clf":0.683,"text":"Demokrasi atau kerakyatan adalah bentuk pemerintahan yang keputusan-keputusan penting, baik secara langsung atau tidak langsung, didasarkan pada kesepakatan mayoritas yang diberikan secara bebas dari masyarakat dewasa. Demokrasi adalah bentuk pemerintahan di mana semua warga negaranya memiliki hak yang sama untuk pengambilan keputusan yang dapat mengubah hidup mereka. Demokrasi mengizinkan warga negara ikut serta, baik secara langsung atau melalui perwakilan, dalam perumusan, pengembangan, dan pembuatan hukum. Demokrasi mencakup kondisi sosial, ekonomi, adat, dan budaya yang memungkinkan adanya praktik kebebasan politik secara bebas dan setara. Demokrasi juga merupakan seperangkat gagasan dan prinsip tentang kebebasan beserta praktik dan prosedurnya. Demokrasi mengandung makna penghargaan terhadap harkat dan martabat manusia.\n\nLandasan demokrasi mencakup kebebasan berkumpul, kebebasan berserikat dan kebebasan berbicara, inklusivitas dan kebebasan politik, kewarganegaraan, persetujuan dari yang diperintah, hak suara, kebebasan dari perampasan pemerintah yang tidak beralasan atas hak untuk hidup dan kebebasan, serta hak kaum minoritas. Kata demokrasi berasal dari bahasa Yunani Kuno yang berarti kekuasaan rakyat. Istilah ini merujuk pada sistem politik yang muncul pada pertengahan abad ke-5 dan ke-4 sebelum Masehi di negara kota Yunani Kuno, khususnya Athena.\n\nMenurut Abraham Lincoln, demokrasi adalah pemerintahan yang berasal dari rakyat, oleh rakyat, dan untuk rakyat. Sementara itu, C. F. Strong menjelaskan bahwa demokrasi adalah sistem pemerintahan di mana mayoritas rakyat berusia dewasa turut serta dalam politik atas dasar sistem perwakilan.\n\nSepanjang masa kemerdekaannya, bangsa Indonesia telah mencoba menerapkan bermacam-macam demokrasi. Periode Demokrasi Parlementer pada 1945 sampai 1965 merupakan awal perkembangan demokrasi di Indonesia. Periode berikutnya adalah Demokrasi Terpimpin pada masa Orde Lama, yang ciri utamanya adalah dominasi politik presiden dan berkembangnya pengaruh komunis serta peranan tentara dalam panggung politik. Periode Demokrasi Pancasila atau Orde Baru berlangsung pada 1965 sampai 1998, yaitu masa pemerintahan Presiden Soeharto. Pada tahun 2010, Perserikatan Bangsa-Bangsa menyatakan 15 September sebagai Hari Demokrasi Internasional.\n","golden":0.2121},{"id":"hf-05-magang","cat":"hf","label":"human","clf":0,"text":"Hari pertama magang, saya gemetar. Bukan karena takut dimarahi, tapi karena mesin fotokopi di kantor kelurahan itu bunyinya seperti mau meledak setiap kali saya menekan tombol hijau besar di pojok kanan atasnya.\n\nSaya ditempatkan di Kelurahan Cigadung, Bandung, mulai 3 Februari sampai 28 Maret 2025, dan tugas pertama saya ternyata bukan mengurus data penduduk seperti bayangan saya selama ini, melainkan membereskan tumpukan arsip surat masuk tahun 2019 yang tingginya hampir menyentuh lutut. Melelahkan. Debunya luar biasa. Bersin saya sampai dihitung Pak Dedi, staf paling senior di sana, katanya sembilan kali sebelum jam sepuluh pagi.\n\nDi minggu kedua barulah saya diajak turun ke lapangan mendata warga penerima bantuan di RW 07, dan di situlah saya pertama kali melihat sendiri bagaimana teori administrasi publik yang selama ini cuma berupa slide PowerPoint di kelas berubah jadi antrean panjang ibu-ibu yang membawa map plastik, sebagian sudah lecek, sebagian lagi masih baru mengkilap. Ada Bu Ratna. Beliau berusia 71 tahun, tinggal sendirian, dan setiap kali ditanya alamat beliau selalu menjawab dengan menyebutkan patokan warung nasi Bu Tini, bukan nama jalan, karena menurutnya semua orang di kampung itu memang lebih hafal warung daripada nama jalan resmi yang terpampang di papan biru di ujung gang.\n\nPengalaman paling berkesan justru datang dari hal sepele: printer macet di hari terakhir pengumpulan berkas, pukul 15.40, sepuluh menit sebelum kantor tutup, dan kami bertiga—saya, Pak Dedi, dan seorang warga bernama Kang Ujang—akhirnya membongkar printer itu di lantai dengan obeng pinjaman dari bengkel sebelah. Berhasil. Rasanya seperti menang lomba.\n\nKalau ditanya apa yang saya pelajari, jawabannya bukan rumus atau teori baru, melainkan kesadaran bahwa data yang rapi di layar komputer selalu punya wajah, punya rumah bercat hijau yang catnya mengelupas, dan punya cerita yang tidak akan pernah muat di kolom Excel mana pun.\n","golden":0.0859},{"id":"hp-01-kos","cat":"hp","label":"human","clf":0.0002,"text":"Kamar kos saya ukurannya tiga kali empat meter, dan di bulan-bulan pertama saya sering bangun tengah malam hanya untuk memastikan kipas angin masih berputar. Bunyinya khas, kretek-kretek setiap putaran ketiga. Ibu kos, Bu Yati, tinggal di rumah depan. Beliau hafal jadwal kuliah saya lebih baik daripada saya sendiri, entah bagaimana caranya.\n\nYang paling berat bukan jauh dari rumah, ternyata. Yang berat itu makan sendirian. Di rumah, makan selalu ramai, ada adik yang merebut lauk, ada ibu yang menambah nasi tanpa diminta. Di kos, saya makan di warteg langganan dekat gerbang kampus, nasi setengah, sayur lodeh, tempe dua, total sembilan ribu rupiah, sambil menatap layar ponsel supaya tidak terlihat terlalu sendirian. Pemilik wartegnya, Pak Haji Udin, sekarang sudah hafal pesanan saya dan selalu bertanya kalau saya dua hari tidak muncul.\n\nUang kiriman datang setiap tanggal lima. Pernah sekali telat sampai tanggal sembilan karena ayah menunggu panen. Empat hari itu saya makan mi instan dan telur, lalu berjanji pada diri sendiri untuk mulai mencatat pengeluaran. Janji itu bertahan sebelas hari.\n\nSekarang sudah semester lima. Kipas anginnya masih kretek-kretek, dan anehnya bunyi itu sekarang justru membuat saya cepat tidur. Mungkin begitulah caranya orang beradaptasi: bukan dengan mengganti keadaan, tetapi dengan berhenti menganggapnya sebagai masalah. Saya masih kangen rumah, tentu saja. Bedanya, sekarang kangen itu tidak lagi terasa seperti beban, melainkan seperti pengingat bahwa ada tempat untuk pulang nanti.\n","golden":0.1857},{"id":"hp-02-kkn","cat":"hp","label":"human","clf":0,"text":"KKN kami ditempatkan di sebuah desa di lereng gunung, dua jam perjalanan dari kampus, dan hari pertama langsung kacau karena mobil pengangkut logistik mogok di tanjakan. Kami mendorong mobil itu beramai-ramai, sembilan orang, sementara ibu-ibu yang menonton dari teras tertawa dan menyuruh kami makan dulu. Program kerja yang kami susun rapi di proposal, lengkap dengan tabel dan target, mulai berantakan sejak minggu pertama.\n\nRencana awal kami adalah mengajar anak-anak membaca setiap sore. Yang datang hari pertama: tiga anak. Hari kedua: dua. Ternyata jam empat sore adalah jam anak-anak membantu orang tua di kebun. Kami pindah jadwal ke malam hari setelah magrib, dan yang datang malah dua puluh anak lebih, sebagian membawa adiknya yang masih digendong. Di situlah saya sadar, proposal ditulis dari meja kampus, sedangkan desa punya jamnya sendiri.\n\nProgram yang paling berhasil justru yang tidak ada di proposal: memperbaiki jembatan bambu kecil menuju kebun. Bukan ide kami. Pak Kepala Dusun yang mengusulkan, kami hanya menyediakan tenaga dan sedikit dana untuk membeli bambu dan paku. Tiga hari jembatan itu selesai, dan warga menyebutnya jembatan anak KKN sampai sekarang, kata teman yang tahun lalu kembali ke sana.\n\nTiga puluh hari berlalu cepat sekali. Saat pulang, saya membawa pulang bukan nilai atau sertifikat, melainkan nomor telepon Bu Painem yang sampai sekarang masih mengirim pesan setiap panen kopi, menanyakan kabar dan apakah saya sudah makan. Pertanyaan terakhir itu tidak pernah absen.\n","golden":0.1876},{"id":"hp-03-ojek","cat":"hp","label":"human","clf":0,"text":"Saya mulai narik ojek daring di semester tiga, awalnya karena uang saku dari orang tua dipotong setengah setelah adik masuk SMA. Motor saya Beat tahun 2016, bensinnya irit, tetapi shockbreaker-nya sudah bunyi setiap melewati polisi tidur. Jaket hijau itu saya cuci seminggu sekali, dan helm cadangan untuk penumpang baunya tidak pernah benar-benar hilang.\n\nJam narik saya atur di sela kuliah: pagi sebelum kelas jam sepuluh, lalu sore sampai malam kalau tidak ada tugas kelompok. Sehari dapat enam sampai sembilan order, lumayan untuk jajan dan bensin. Yang tidak terduga adalah penumpang-penumpangnya. Ada bapak yang setiap Jumat minta diantar ke masjid yang sama dan selalu memberi tip lima ribu sambil bilang buat bensin, Nak. Ada juga penumpang yang marah-marah karena saya tidak tahu jalan pintas yang bahkan tidak ada di peta.\n\nPernah sekali saya mengantar pesanan makanan ke alamat yang ternyata salah titik, dan pelanggan menolak membayar karena makanannya sudah dingin. Saya yang menanggung. Malam itu saya pulang dengan perasaan campur aduk, lalu tetap menyalakan aplikasi keesokan paginya karena cicilan motor tidak peduli pada perasaan saya.\n\nDari pekerjaan ini saya belajar membaca kota dengan cara yang tidak diajarkan di kelas mana pun: gang mana yang banjir setelah hujan dua jam, jam berapa jalan protokol mulai macet, dan di mana warung kopi yang membiarkan driver berteduh tanpa harus membeli. Pengetahuan semacam itu tidak masuk transkrip nilai, tetapi entah kenapa terasa sama berharganya.\n","golden":0.2209},{"id":"hp-04-skripsi","cat":"hp","label":"human","clf":0,"text":"Perpustakaan kampus lantai tiga adalah tempat saya menghabiskan hampir semua malam di semester delapan. Bukan karena rajin. Di kos terlalu banyak godaan: kasur, ponsel, dan teman sebelah kamar yang selalu mengajak main gim. Di perpus, setidaknya rasa malu membuat saya membuka laptop, karena semua orang di sekeliling tampak sedang berjuang dengan hal yang sama.\n\nBab tiga saya ditolak dua kali. Dosen pembimbing saya, Pak Bambang, orangnya hemat kata. Komentar beliau di margin biasanya hanya satu dua kalimat, misalnya ini maksudnya apa, atau sumbernya mana. Awalnya saya kesal. Lama-lama saya sadar kalimat-kalimat pendek itu justru yang paling jujur, dan setiap kali saya bisa menjawabnya, tulisan saya memang membaik.\n\nAda ritual kecil yang terbentuk tanpa direncanakan. Jam sembilan malam, saya dan dua teman seperjuangan turun ke kantin belakang untuk kopi sachet dan gorengan. Kami tidak membicarakan skripsi di meja itu. Kami membicarakan apa saja kecuali skripsi. Dua puluh menit, lalu naik lagi. Ritual itu yang membuat malam-malam panjang tersebut bisa ditanggung.\n\nSkripsi saya akhirnya selesai juga, 112 halaman, dan bukan karya yang membanggakan. Ada bab yang saya tahu bisa lebih baik. Tetapi ketika saya mengumpulkan berkas terakhir ke bagian akademik dan petugasnya memberi stempel tanpa drama apa pun, saya berdiri sebentar di depan loket itu dengan perasaan aneh: lega, kosong, dan sedikit tidak percaya bahwa sesuatu yang menghantui saya selama setahun ternyata berakhir dengan sebuah stempel.\n","golden":0.1395}];
  var BN_V0 = {"meta":{"engine":"Ensemble Heuristik v3 — analyze() persis produksi (diekstrak dari index.html; gerbang regresi Phase 1 hijau)","dataset":"VeritasAI-ID v0 (DATASET_CARD.md, dibangun 2026-11-20)","evaluatedAt":"2026-11-20","script":"evaluate-v0.cjs","convention":"analyze() atas teks penuh dokumen (konvensi benchmark proyek); kelas positif = AI (skor >= ambang)","thresholds":[0.35,0.65]},"sets":{"test":{"at035":{"n":2257,"TP":100,"TN":1905,"FP":28,"FN":224,"accuracy":0.8883,"precision":0.7813,"recall":0.3086,"f1":0.4425,"fpr":0.0145,"fnr":0.6914,"specificity":0.9855,"macroF1":0.6902,"weightedF1":0.8668},"at065":{"n":2257,"TP":0,"TN":1933,"FP":0,"FN":324,"accuracy":0.8564,"precision":null,"recall":0,"f1":null,"fpr":0,"fnr":1,"specificity":1,"macroF1":null,"weightedF1":null},"meanScoreHuman":0.1898,"meanScoreAi":0.3205,"bySource":{"m4_id":{"at035":{"n":622,"TP":100,"TN":295,"FP":3,"FN":224,"accuracy":0.635,"precision":0.9709,"recall":0.3086,"f1":0.4684,"fpr":0.0101,"fnr":0.6914,"specificity":0.9899,"macroF1":0.5953,"weightedF1":0.59}},"liputan6":{"at035":{"n":689,"TP":0,"TN":688,"FP":1,"FN":0,"accuracy":0.9985,"precision":0,"recall":null,"f1":null,"fpr":0.0015,"fnr":null,"specificity":0.9985,"macroF1":null,"weightedF1":null}},"wikipedia_id":{"at035":{"n":691,"TP":0,"TN":669,"FP":22,"FN":0,"accuracy":0.9682,"precision":0,"recall":null,"f1":null,"fpr":0.0318,"fnr":null,"specificity":0.9682,"macroF1":null,"weightedF1":null}},"id_newspapers_2018":{"at035":{"n":255,"TP":0,"TN":253,"FP":2,"FN":0,"accuracy":0.9922,"precision":0,"recall":null,"f1":null,"fpr":0.0078,"fnr":null,"specificity":0.9922,"macroF1":null,"weightedF1":null}}},"byDomain":{"news":{"at035":{"n":1566,"TP":100,"TN":1236,"FP":6,"FN":224,"accuracy":0.8531,"precision":0.9434,"recall":0.3086,"f1":0.4651,"fpr":0.0048,"fnr":0.6914,"specificity":0.9952,"macroF1":0.69,"weightedF1":0.8218}},"encyclopedic":{"at035":{"n":691,"TP":0,"TN":669,"FP":22,"FN":0,"accuracy":0.9682,"precision":0,"recall":null,"f1":null,"fpr":0.0318,"fnr":null,"specificity":0.9682,"macroF1":null,"weightedF1":null}}},"byLength":{"300-800 kata":{"at035":{"n":824,"TP":72,"TN":564,"FP":13,"FN":175,"accuracy":0.7718,"precision":0.8471,"recall":0.2915,"f1":0.4337,"fpr":0.0225,"fnr":0.7085,"specificity":0.9775,"macroF1":0.6454,"weightedF1":0.7302}},"<300 kata":{"at035":{"n":1038,"TP":28,"TN":958,"FP":3,"FN":49,"accuracy":0.9499,"precision":0.9032,"recall":0.3636,"f1":0.5185,"fpr":0.0031,"fnr":0.6364,"specificity":0.9969,"macroF1":0.746,"weightedF1":0.9398}},">800 kata":{"at035":{"n":395,"TP":0,"TN":383,"FP":12,"FN":0,"accuracy":0.9696,"precision":0,"recall":null,"f1":null,"fpr":0.0304,"fnr":null,"specificity":0.9696,"macroF1":null,"weightedF1":null}}}},"stress":{"at035":{"n":1000,"TP":0,"TN":981,"FP":19,"FN":0,"accuracy":0.981,"precision":0,"recall":null,"f1":null,"fpr":0.019,"fnr":null,"specificity":0.981,"macroF1":null,"weightedF1":null},"at065":{"n":1000,"TP":0,"TN":1000,"FP":0,"FN":0,"accuracy":1,"precision":null,"recall":null,"f1":null,"fpr":0,"fnr":null,"specificity":1,"macroF1":null,"weightedF1":null},"meanScoreHuman":0.2147,"meanScoreAi":null},"external":{"at035":{"n":889,"TP":13,"TN":448,"FP":11,"FN":417,"accuracy":0.5186,"precision":0.5417,"recall":0.0302,"f1":0.0573,"fpr":0.024,"fnr":0.9698,"specificity":0.976,"macroF1":0.367,"weightedF1":0.3771},"at065":{"n":889,"TP":0,"TN":459,"FP":0,"FN":430,"accuracy":0.5163,"precision":null,"recall":0,"f1":null,"fpr":0,"fnr":1,"specificity":1,"macroF1":null,"weightedF1":null},"meanScoreHuman":0.2033,"meanScoreAi":0.2848,"byLength":{"<300 kata":{"at035":{"n":889,"TP":13,"TN":448,"FP":11,"FN":417,"accuracy":0.5186,"precision":0.5417,"recall":0.0302,"f1":0.0573,"fpr":0.024,"fnr":0.9698,"specificity":0.976,"macroF1":0.367,"weightedF1":0.3771}}}}}};
  var BN_CATNAME = { hf: "Manusia formal", hp: "Manusia personal", ai: "AI formal", ap: "AI parafrase" };

  /* EVAL-CORE-START */
  function bnRate(num, den){ return den === 0 ? null : num / den; }
  function bnSide(items, thr, pos){
    var TP = 0, FP = 0, FN = 0, TN = 0;
    items.forEach(function(it){
      var predAi = it.score >= thr;
      var isPos = it.label === pos;
      var predPos = pos === "ai" ? predAi : !predAi;
      if(isPos && predPos) TP++; else if(isPos) FN++; else if(predPos) FP++; else TN++;
    });
    var precision = bnRate(TP, TP + FP), recall = bnRate(TP, TP + FN);
    var f1 = (precision === null || recall === null || precision + recall === 0) ? null : 2 * precision * recall / (precision + recall);
    return { TP: TP, FP: FP, FN: FN, TN: TN, precision: precision, recall: recall, f1: f1, support: TP + FN };
  }
  function bnMetrics(items, thr){
    var ai = bnSide(items, thr, "ai"), hu = bnSide(items, thr, "human"), n = items.length;
    return {
      n: n, TP: ai.TP, TN: ai.TN, FP: ai.FP, FN: ai.FN,
      accuracy: bnRate(ai.TP + ai.TN, n), precision: ai.precision, recall: ai.recall, f1: ai.f1,
      fpr: bnRate(ai.FP, ai.FP + ai.TN), fnr: bnRate(ai.FN, ai.FN + ai.TP), specificity: bnRate(ai.TN, ai.TN + ai.FP),
      macroF1: (ai.f1 === null || hu.f1 === null) ? null : (ai.f1 + hu.f1) / 2,
      weightedF1: (ai.f1 === null || hu.f1 === null || n === 0) ? null : (ai.f1 * ai.support + hu.f1 * hu.support) / n
    };
  }
  function bnBlend(heur, clf){ return heur >= 0.35 ? heur + (1 - heur) * clf * 0.5 : heur; }
  /* EVAL-CORE-END */

  var bnState = { ran: false, live: null, liveMetrics: null };
  function bnFmtID(x, dec){ var p = Number(x).toFixed(dec).split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); return p.length > 1 ? p[0] + "," + p[1] : p[0]; }
  function bnPct(x){ return x === null || x === undefined ? "tidak terdefinisi" : bnFmtID(x * 100, 1) + "%"; }
  function bnNum(x){ return x === null || x === undefined ? "—" : bnFmtID(x, 0); }
  function bnMetricRows(m){
    return "<tr><td>Akurasi</td><td>" + bnPct(m.accuracy) + "</td></tr>" +
      "<tr><td>Precision (kelas AI)</td><td>" + bnPct(m.precision) + "</td></tr>" +
      "<tr><td>Recall (kelas AI)</td><td>" + bnPct(m.recall) + "</td></tr>" +
      "<tr><td>F1 (kelas AI)</td><td>" + bnPct(m.f1) + "</td></tr>" +
      "<tr><td>FPR — manusia terindikasi</td><td>" + bnPct(m.fpr) + "</td></tr>" +
      "<tr><td>FNR — AI lolos</td><td>" + bnPct(m.fnr) + "</td></tr>" +
      "<tr><td>Specificity</td><td>" + bnPct(m.specificity) + "</td></tr>" +
      "<tr><td>Macro F1 (dua kelas)</td><td>" + bnPct(m.macroF1) + "</td></tr>" +
      "<tr><td>Weighted F1 (dukungan kelas)</td><td>" + bnPct(m.weightedF1) + "</td></tr>";
  }
  function bnCmHtml(m){
    return "<div class=\"bn-cm\" role=\"group\" aria-label=\"Matriks kebingungan (confusion matrix): TP " + m.TP + " (AI yang terindikasi, benar), FN " + m.FN + " (AI yang lolos, terlewat), FP " + m.FP + " (manusia yang terindikasi, salah tuduh), TN " + m.TN + " (manusia yang lolos, benar)\">" +
      "<div class=\"bn-h\"></div><div class=\"bn-h\">Prediksi: terindikasi AI</div><div class=\"bn-h\">Prediksi: manusia</div>" +
      "<div class=\"bn-h\">Aktual: AI</div>" +
      "<div class=\"bn-cell tp\"><div class=\"bn-n\">" + m.TP + "</div><div class=\"bn-t\">TP — AI yang terindikasi (benar)</div></div>" +
      "<div class=\"bn-cell fn\"><div class=\"bn-n\">" + m.FN + "</div><div class=\"bn-t\">FN — AI yang lolos (terlewat)</div></div>" +
      "<div class=\"bn-h\">Aktual: manusia</div>" +
      "<div class=\"bn-cell fp\"><div class=\"bn-n\">" + m.FP + "</div><div class=\"bn-t\">FP — manusia yang terindikasi (salah tuduh)</div></div>" +
      "<div class=\"bn-cell tn\"><div class=\"bn-n\">" + m.TN + "</div><div class=\"bn-t\">TN — manusia yang lolos (benar)</div></div></div>";
  }
  function bnRenderCards(liveM){
    $("bn-cards").innerHTML =
      "<div class=\"wf-card\"><div class=\"wf-num\">4.146</div><div class=\"wf-lab\">dokumen VeritasAI-ID v0 dievaluasi (test + stress + eksternal)</div></div>" +
      "<div class=\"wf-card\"><div class=\"wf-num\">" + bnPct(BN_V0.sets.test.at035.fpr) + "</div><div class=\"wf-lab\">FPR heuristik pada test v0 — 28 dari 1.933 dokumen manusia terindikasi</div></div>" +
      "<div class=\"wf-card\"><div class=\"wf-num\">" + bnPct(BN_V0.sets.external.at035.recall) + "</div><div class=\"wf-lab\">recall heuristik pada GPT-4o (set eksternal) — kelemahan lintas-generator, apa adanya</div></div>" +
      "<div class=\"wf-card\"><div class=\"wf-num\">" + liveM.FP + "/9</div><div class=\"wf-lab\">false positive pada set regresi langsung (dihitung ulang saat halaman dibuka)</div></div>" +
      "<div class=\"wf-card\"><div class=\"wf-num\">20 Nov 2026</div><div class=\"wf-lab\">tanggal evaluasi v0 · mesin Ensemble Heuristik v3 (identik produksi, gerbang regresi hijau)</div></div>" +
      "<div class=\"wf-card\"><div class=\"wf-num\">0</div><div class=\"wf-lab\">duplikat eksak, pelanggaran group-split, dan tumpang-tindih dengan set regresi — hasil audit terverifikasi</div></div>";
  }
  function bnRenderAudit(){
    var rows = [
      ["Benchmark regresi (fikstur situs)", 18, 9, 9, "Gerbang rilis — dievaluasi langsung di halaman ini"],
      ["VeritasAI-ID v0 — train", 18053, 15639, 2414, "Latih model internal; tidak dievaluasi di sini"],
      ["VeritasAI-ID v0 — dev", 2257, 1996, 261, "Pemilihan model internal; tidak dievaluasi di sini"],
      ["VeritasAI-ID v0 — test", 2257, 1933, 324, "Dievaluasi (heuristik)"],
      ["VeritasAI-ID v0 — stress manusia formal", 1000, 1000, 0, "Dievaluasi (khusus FPR)"],
      ["COLING-2025 — test eksternal", 889, 459, 430, "Dievaluasi (GPT-4o, generator tak terlihat)"]
    ];
    var h = "<table class=\"wf-table\"><thead><tr><th>Set</th><th>n</th><th>Manusia</th><th>AI</th><th>Peran</th></tr></thead><tbody>";
    rows.forEach(function(r){ h += "<tr><td>" + r[0] + "</td><td>" + bnFmtID(r[1], 0) + "</td><td>" + bnFmtID(r[2], 0) + "</td><td>" + bnFmtID(r[3], 0) + "</td><td>" + r[4] + "</td></tr>"; });
    h += "</tbody></table>";
    h += "<ul class=\"wf-list\">" +
      "<li><strong>Duplikasi eksak</strong> (hash teks ternormalisasi): 0 di dalam setiap berkas, 0 lintas split.</li>" +
      "<li><strong>Group-split berbasis cluster</strong>: 0 pelanggaran dari 19.670 cluster unik (train/dev/test) — dokumen yang saling mirip tidak menyebar ke split berbeda.</li>" +
      "<li><strong>Dekontaminasi</strong>: 0 dokumen v0 berbagi 13-gram kata dengan ke-18 sampel regresi — kedua evaluasi benar-benar terpisah.</li>" +
      "<li><strong>Ketidakseimbangan</strong>: v0 berisi 87% manusia : 13% AI — akurasi mentah menyesatkan tanpa metrik per kelas.</li>" +
      "<li><strong>Generator</strong>: seluruh AI v0 = GPT-3.5 (era 2023); seluruh AI eksternal = GPT-4o. Tidak ada generator lain di data yang tersedia.</li>" +
      "<li><strong>Domain</strong>: berita + ensiklopedis saja (50–2.000 kata). Esai/tugas mahasiswa — genre utama produk — <strong>tidak terwakili</strong> di v0; set regresi (esai pendek) mengisi sebagian, tetapi terlalu kecil untuk generalisasi.</li></ul>";
    $("bn-audit").innerHTML = h;
  }
  function bnRenderLive(){
    var items = BN_SAMPLES.map(function(s){
      var score = analyze(s.text).final;
      return { id: s.id, cat: s.cat, label: s.label, score: score, golden: s.golden, clf: s.clf };
    });
    bnState.live = items;
    var m = bnMetrics(items.map(function(it){ return { label: it.label, score: it.score }; }), 0.35);
    bnState.liveMetrics = m;
    var consistent = items.every(function(it){ return Math.round(it.score * 10000) / 10000 === it.golden; });
    var h = "<p>" + (consistent
      ? "<span class=\"bn-pill ok\">Konsisten dengan baseline Phase 0 — ke-18 skor identik</span>"
      : "<span class=\"bn-pill\">Perhatian: ada skor yang berbeda dari baseline Phase 0</span>") + "</p>";
    h += bnCmHtml(m);
    h += "<table class=\"wf-table\"><tbody>" + bnMetricRows(m) + "</tbody></table>";
    h += "<h4 style=\"margin:16px 0 6px;\">Per kategori sampel</h4><table class=\"wf-table\"><thead><tr><th>Kategori</th><th>n</th><th>TP</th><th>FP</th><th>TN</th><th>FN</th><th>Recall / FPR</th></tr></thead><tbody>";
    ["hf", "hp", "ai", "ap"].forEach(function(cat){
      var sub = items.filter(function(it){ return it.cat === cat; });
      var sm = bnMetrics(sub.map(function(it){ return { label: it.label, score: it.score }; }), 0.35);
      var rf = sub[0].label === "ai" ? "Recall " + bnPct(sm.recall) : "FPR " + bnPct(sm.fpr);
      h += "<tr><td>" + BN_CATNAME[cat] + "</td><td>" + sm.n + "</td><td>" + sm.TP + "</td><td>" + sm.FP + "</td><td>" + sm.TN + "</td><td>" + sm.FN + "</td><td>" + rf + "</td></tr>";
    });
    h += "</tbody></table>";
    h += "<h4 style=\"margin:16px 0 6px;\">Per sampel (ambang 0,35)</h4><table class=\"wf-table\"><thead><tr><th>Sampel</th><th>Kategori</th><th>Label</th><th>Skor</th><th>Prediksi</th><th>Hasil</th></tr></thead><tbody>";
    items.forEach(function(it){
      var pred = it.score >= 0.35;
      var ok = (pred && it.label === "ai") || (!pred && it.label === "human");
      h += "<tr><td>" + escapeHtml(it.id) + "</td><td>" + BN_CATNAME[it.cat] + "</td><td>" + (it.label === "ai" ? "AI" : "Manusia") + "</td><td>" + bnFmtID(it.score * 100, 1) + "%</td><td>" + (pred ? "Terindikasi" : "Manusia") + "</td><td>" + (ok ? "Benar" : "<strong>Salah</strong>") + "</td></tr>";
    });
    h += "</tbody></table>";
    h += "<p class=\"wf-note\">Seluruh sampel parafrase AI (ap-01 s.d. ap-04) lolos di bawah ambang — titik buta parafrase yang sudah didokumentasikan sejak Phase 0, tampil di sini apa adanya.</p>";
    $("bn-live").innerHTML = h;
    return m;
  }
  function bnV0SetTable(title, set, note){
    var m = set.at035;
    var h = "<h4 style=\"margin:16px 0 6px;\">" + title + " — ambang 0,35</h4>" + bnCmHtml(m) +
      "<table class=\"wf-table\"><tbody>" + bnMetricRows(m) + "</tbody></table>" +
      "<p class=\"wf-note\">Rata-rata skor: manusia " + bnFmtID(set.meanScoreHuman * 100, 1) + "% · AI " + (set.meanScoreAi === null ? "—" : bnFmtID(set.meanScoreAi * 100, 1) + "%") + ". Pada ambang 0,65 (pita TINGGI): TP " + set.at065.TP + ", FP " + set.at065.FP + ". " + note + "</p>";
    return h;
  }
  function bnRenderV0(){
    var h = bnV0SetTable("Split test (AI = GPT-3.5)", BN_V0.sets.test, "Recall rendah: sebagian besar teks AI berita tidak memuat penanda frasa/stilometri yang dikenali Lapis 1.");
    h += bnV0SetTable("Stress manusia formal (khusus FPR)", BN_V0.sets.stress, "Set ini hanya berisi manusia; precision/recall kelas AI tidak terdefinisi dan ditampilkan apa adanya di mesin metrik yang sama.");
    h += bnV0SetTable("Eksternal COLING (AI = GPT-4o)", BN_V0.sets.external, "Generator yang tidak terlihat selama pengembangan: recall runtuh ke 3,0% — bukti terukur bahwa performa tidak berpindah antar-generator.");
    var t = BN_V0.sets.test;
    h += "<h4 style=\"margin:16px 0 6px;\">Split test per kategori (ambang 0,35)</h4>";
    function catTable(title, groups){
      var s = "<p class=\"wf-note\" style=\"margin-bottom:4px;\"><strong>" + title + "</strong></p><table class=\"wf-table\"><thead><tr><th>Kategori</th><th>n</th><th>Recall (AI)</th><th>FPR (manusia)</th></tr></thead><tbody>";
      for(var k in groups){ var g = groups[k].at035; s += "<tr><td>" + escapeHtml(k) + "</td><td>" + bnFmtID(g.n, 0) + "</td><td>" + bnPct(g.recall) + "</td><td>" + bnPct(g.fpr) + "</td></tr>"; }
      return s + "</tbody></table>";
    }
    h += catTable("Per domain", t.byDomain) + catTable("Per sumber", t.bySource) + catTable("Per panjang dokumen", t.byLength);
    h += "<p class=\"wf-note\">Seluruh dokumen AI pada split test berasal dari M4 (berita); kategori tanpa dokumen AI menampilkan recall sebagai tidak terdefinisi. FPR tertinggi ada pada Wikipedia (3,2%) — teks ensiklopedis formal paling sering memicu penanda.</p>";
    $("bn-v0").innerHTML = h;
  }
  function bnRenderClf(){
    var items = bnState.live || [];
    var heur = items.map(function(it){ return { label: it.label, score: it.score }; });
    var clf = items.map(function(it){ return { label: it.label, score: it.clf }; });
    var blend = items.map(function(it){ return { label: it.label, score: bnBlend(it.score, it.clf) }; });
    var mh = bnMetrics(heur, 0.35), mc = bnMetrics(clf, 0.5), mb = bnMetrics(blend, 0.35);
    function row(name, m, note){
      return "<tr><td><strong>" + name + "</strong><br /><span class=\"wf-note\">" + note + "</span></td><td>" + m.TP + "</td><td>" + m.TN + "</td><td>" + m.FP + "</td><td>" + m.FN + "</td><td>" + bnPct(m.accuracy) + "</td><td>" + bnPct(m.precision) + "</td><td>" + bnPct(m.recall) + "</td><td>" + bnPct(m.f1) + "</td><td>" + bnPct(m.fpr) + "</td></tr>";
    }
    var waspada = items.filter(function(it){ return it.score < 0.35 && it.clf >= 0.85; }).length;
    $("bn-clf").innerHTML =
      "<p class=\"wf-note\">Skor classifier per sampel dihitung offline satu kali (20 November 2026) dengan pipeline yang sama persis seperti produksi — potongan paragraf ±1.200 karakter, rata-rata probabilitas AI, model <em>saksara/ai-text-detector-onnx</em> (konversi publik XLM-RoBERTa HC3; id2label 1 = ChatGPT) — lalu disematkan sebagai data statis berprovenans ini. Ambang 0,5 untuk classifier bersifat ilustratif: produksi tidak pernah memakai classifier sendirian.</p>" +
      "<table class=\"wf-table\"><thead><tr><th>Varian</th><th>TP</th><th>TN</th><th>FP</th><th>FN</th><th>Akurasi</th><th>Precision</th><th>Recall</th><th>F1</th><th>FPR</th></tr></thead><tbody>" +
      row("Ensemble Heuristik v3", mh, "ambang 0,35") +
      row("Classifier saja", mc, "ambang ilustratif 0,5") +
      row("Gabungan produksi (blend bergerbang)", mb, "classifier hanya menaikkan skor bila heuristik ≥ 0,35; ambang 0,35") +
      "</tbody></table>" +
      "<p class=\"wf-note\">Bacaan jujurnya: sendirian, classifier menandai <strong>4 dari 5 sampel manusia formal</strong> sebagai AI (probabilitas 0,68–1,00) — teks ensiklopedis formal memang mirip keluaran ChatGPT bagi model HC3. Gerbang blend produksi mencegah keempatnya menaikkan skor akhir (heuristiknya di bawah 0,35), sehingga gabungan mewarisi keamanan heuristik pada set ini; pada " + waspada + " sampel manusia formal itu, panel Detector menampilkan spanduk SINYAL WASPADA untuk peninjauan manual — perilaku konservatif yang disengaja, bukan vonis. Sebaliknya seluruh parafrase AI lolos di ketiga varian.</p>";
  }
  function bnRenderDist(){
    var sets = [
      ["Set regresi", 9, 9],
      ["v0 test", 1933, 324],
      ["v0 stress", 1000, 0],
      ["Eksternal COLING", 459, 430]
    ];
    var h = "<p class=\"wf-note\" style=\"margin-bottom:8px;\"><span class=\"cmp-dist-fill fill-a\" style=\"display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:middle;\"></span> Manusia &nbsp; <span class=\"cmp-dist-fill fill-b\" style=\"display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:middle;\"></span> AI</p>";
    sets.forEach(function(s){
      var total = s[1] + s[2];
      h += "<div class=\"cmp-dist-row\"><span class=\"cmp-dist-lab\">" + s[0] + "</span>" +
        "<span class=\"cmp-dist-track\"><span class=\"cmp-dist-fill fill-a\" style=\"width:" + (total ? s[1] / total * 100 : 0) + "%\"></span></span>" +
        "<span class=\"cmp-dist-val\">" + bnFmtID(s[1], 0) + " · " + bnFmtID(s[2], 0) + "</span></div>";
    });
    h += "<p class=\"wf-note\">Bar menunjukkan proporsi manusia (biru) vs AI (toska) per set; angka di kanan adalah jumlah dokumennya. Ketimpangan v0 (87 : 13) adalah alasan halaman ini selalu menampilkan metrik per kelas di samping akurasi.</p>";
    $("bn-dist").innerHTML = h;
  }
  function bnExportObj(){
    return {
      generatedAt: new Date().toISOString(),
      engine: "Ensemble Heuristik v3 (produksi); classifier saksara/ai-text-detector-onnx",
      liveRegressionSet: { metricsAt035: bnState.liveMetrics, samples: (bnState.live || []).map(function(it){ return { sample: it.id, category: it.cat, label: it.label, heuristic: Math.round(it.score * 10000) / 10000, classifier: it.clf, blend: Math.round(bnBlend(it.score, it.clf) * 10000) / 10000 }; }) },
      veritasAiIdV0: BN_V0
    };
  }
  function bnDownload(name, text, type){
    var blob = new Blob([text], { type: type });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function bnInit(){
    if(bnState.ran) return;
    bnState.ran = true;
    bnRenderAudit();
    var liveM = bnRenderLive();
    bnRenderCards(liveM);
    bnRenderV0();
    bnRenderClf();
    bnRenderDist();
  }
  $("bn-export-json").addEventListener("click", function(){
    bnDownload("saksara-benchmark.json", JSON.stringify(bnExportObj(), null, 1), "application/json");
    $("bn-export-status").textContent = "JSON evaluasi diunduh (dibangun lokal dari angka yang tampil di halaman ini).";
  });
  $("bn-export-csv").addEventListener("click", function(){
    var lines = ["set,ambang,n,TP,TN,FP,FN,akurasi,precision,recall,f1,fpr,fnr"];
    function push(name, thr, m){ lines.push([name, thr, m.n, m.TP, m.TN, m.FP, m.FN, m.accuracy, m.precision, m.recall, m.f1, m.fpr, m.fnr].map(function(v){ return v === null || v === undefined ? "" : v; }).join(",")); }
    if(bnState.liveMetrics) push("regresi-live", 0.35, bnState.liveMetrics);
    push("v0-test", 0.35, BN_V0.sets.test.at035); push("v0-test", 0.65, BN_V0.sets.test.at065);
    push("v0-stress", 0.35, BN_V0.sets.stress.at035);
    push("eksternal-coling", 0.35, BN_V0.sets.external.at035); push("eksternal-coling", 0.65, BN_V0.sets.external.at065);
    bnDownload("saksara-benchmark.csv", lines.join("\n"), "text/csv");
    $("bn-export-status").textContent = "CSV metrik diunduh (dibangun lokal dari angka yang tampil di halaman ini).";
  });
  window.addEventListener("hashchange", function(){ if((location.hash || "").indexOf("benchmark") >= 0) bnInit(); });
  if((location.hash || "").indexOf("benchmark") >= 0) bnInit();


    /* ==================================================================
       Phase 6 (v0.14.0-beta): Productivity — OCR, Riwayat, Batch 2.0,
       Report 2.0. Tidak menyentuh mesin deteksi. Seluruh fitur di blok
       ini opt-in atau lokal; tidak ada unggahan apa pun.
       ================================================================== */

    /* PROD-CORE-START — fungsi murni (diuji prod-test.cjs) */
    var P6_BATCH_MAX_FILES = 50;
    var P6_BATCH_MAX_FILE = 20 * 1024 * 1024; /* samakan dengan MAX_FILE_BYTES */
    var P6_BATCH_MAX_TOTAL = 100 * 1024 * 1024;
    var P6_TEXT_MAX = 200000;
    function p6ValidateBatch(metas){
      var accepted = [], rejected = [], total = 0;
      for(var i = 0; i < metas.length; i++){
        var m = metas[i];
        if(i >= P6_BATCH_MAX_FILES){ rejected.push({ name: m.name, reason: "Lewat dari batas " + P6_BATCH_MAX_FILES + " berkas per batch — berkas ini tidak ikut diproses." }); continue; }
        if(typeof m.size === "number" && m.size > P6_BATCH_MAX_FILE){ rejected.push({ name: m.name, reason: "Ukuran berkas lewat dari batas 20 MB per berkas." }); continue; }
        if(typeof m.size === "number" && total + m.size > P6_BATCH_MAX_TOTAL){ rejected.push({ name: m.name, reason: "Total ukuran batch lewat dari batas 100 MB." }); continue; }
        total += (typeof m.size === "number" ? m.size : 0);
        accepted.push({ name: m.name, size: m.size });
      }
      return { accepted: accepted, rejected: rejected, totalBytes: total };
    }
    function p6OcrAggregate(pages){
      var tw = 0, cw = 0, low = [], empty = [];
      pages.forEach(function(p, i){
        var w = p.words || 0;
        tw += w; cw += (p.confidence || 0) * w;
        if(w === 0) empty.push(i + 1);
        else if(p.confidence < 60) low.push(i + 1);
      });
      return { meanConfidence: tw > 0 ? Math.round((cw / tw) * 10) / 10 : 0, totalWords: tw, lowPages: low, emptyPages: empty };
    }
    function p6SanitizeEntry(entry, storeText){
      var e = { ts: entry.ts, kind: entry.kind, title: entry.title, summary: entry.summary, text: null, textTruncated: false };
      if(storeText && typeof entry.text === "string" && entry.text){
        if(entry.text.length > P6_TEXT_MAX){ e.text = entry.text.slice(0, P6_TEXT_MAX); e.textTruncated = true; }
        else e.text = entry.text;
      }
      return e;
    }
    function p6BatchSummary(rows){
      var ok = [], err = 0, bands = { RENDAH: 0, SEDANG: 0, TINGGI: 0 };
      rows.forEach(function(r){
        if(r.error){ err++; return; }
        ok.push(r.score);
        if(r.score < 0.35) bands.RENDAH++;
        else if(r.score <= 0.65) bands.SEDANG++;
        else bands.TINGGI++;
      });
      ok.sort(function(a, b){ return a - b; });
      var mean = ok.length ? ok.reduce(function(a, b){ return a + b; }, 0) / ok.length : null;
      var median = ok.length ? (ok.length % 2 ? ok[(ok.length - 1) / 2] : (ok[ok.length / 2 - 1] + ok[ok.length / 2]) / 2) : null;
      return { total: rows.length, ok: ok.length, err: err, mean: mean, median: median, bands: bands };
    }
    /* PROD-CORE-END */

    function histTitleOf(text){
      var t = String(text || "").replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 60) : "(tanpa judul)";
    }
    function p6FmtBytes(n){
      if(typeof n !== "number") return "—";
      if(n >= 1048576) return (n / 1048576).toFixed(1).replace(".", ",") + " MB";
      if(n >= 1024) return Math.round(n / 1024) + " KB";
      return n + " B";
    }
    function p6LoadScript(url){
      return new Promise(function(resolve, reject){
        var s = document.createElement("script");
        s.src = url; s.async = true;
        if(typeof saksaraSriApply === "function") saksaraSriApply(s, url);
        s.onload = function(){ resolve(); };
        s.onerror = function(){ reject(new Error("Gagal memuat " + url)); };
        document.head.appendChild(s);
      });
    }

    /* ================= PDF.js bersama (D7-B) =================
       SATU jalur pemuatan PDF.js untuk Document Intelligence dan OCR.
       PDF.js 4.10.38, build LEGACY, dari jsDelivr (satu CDN yang sama
       untuk pustaka dan worker; versi ter-pin persis):
         pustaka: https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs
         worker:  https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs
       Sejak 4.x tidak ada lagi build UMD/<script> klasik — pustaka
       dimuat malas (lazy) lewat dynamic import() dan namespace-nya
       dipasang ke window.pdfjsLib agar kedua pemanggil tetap membaca
       tempat yang sama. Panggilan bersamaan berbagi SATU promise yang
       sedang berjalan (tanpa muat ulang / race). Bila import() gagal,
       state pemuat DIBERSIHKAN sebelum galat diteruskan, sehingga
       percobaan berikutnya dapat berhasil — state tidak teracuni
       permanen. p6LoadScript di atas TIDAK diubah dan tetap dipakai
       pustaka lain (jsPDF, docx, Tesseract) beserta SRI-nya.
       SRI: dynamic import() tidak dapat membawa integrity, jadi
       berkas utama pdf.js TIDAK lagi ber-SRI runtime (kehilangan ini
       disetujui eksplisit oleh pemilik pada mandat D7-B). Hash berikut
       dicatat sebagai PROVENANCE saja — dihitung dari dua unduhan
       byte-identik pada 22 Nov 2026 — BUKAN perlindungan SRI runtime:
         pdf.min.mjs        sha384-z/XbAtvhBXJoK+yvYimnFuTCF6/2wTCDSIFD09/HtIfwFtvDKOMdAe5Z3wOChkmW
         pdf.worker.min.mjs sha384-vbNBYP03jHFPlgtK4qSXtazEmGfmpTWlSsfq9OiU20MroW/Q9TbaEXiM7PpeWg+6 */
    var saksaraPdfJsPromise = null;
    function saksaraLoadPdfJs(){
      if(window.pdfjsLib){
        if(!window.pdfjsLib.GlobalWorkerOptions.workerSrc)
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = OCR_PDFJS_WORKER;
        return Promise.resolve(window.pdfjsLib);
      }
      if(!saksaraPdfJsPromise){
        saksaraPdfJsPromise = import(OCR_PDFJS).then(function(mod){
          var lib = (mod && typeof mod.getDocument === "function") ? mod
            : (mod && mod.default && typeof mod.default.getDocument === "function") ? mod.default : null;
          if(!lib) throw new Error("Modul PDF.js tidak lengkap");
          window.pdfjsLib = lib;
          lib.GlobalWorkerOptions.workerSrc = OCR_PDFJS_WORKER;
          return lib;
        }).catch(function(err){
          saksaraPdfJsPromise = null; /* bersihkan state: izinkan percobaan ulang */
          throw err;
        });
      }
      return saksaraPdfJsPromise;
    }

    /* ---------------- Riwayat (IndexedDB, opt-in) ---------------- */
    var HIST_LS_ON = "saksara-history-enabled", HIST_LS_TEXT = "saksara-history-text";
    function histEnabled(){ try { return localStorage.getItem(HIST_LS_ON) === "1"; } catch(e){ return false; } }
    function histTextAllowed(){ try { return localStorage.getItem(HIST_LS_TEXT) === "1"; } catch(e){ return false; } }
    var histDbPromise = null;
    function histDb(){
      if(histDbPromise) return histDbPromise;
      histDbPromise = new Promise(function(resolve, reject){
        var req = indexedDB.open("saksara-history", 1);
        req.onupgradeneeded = function(){
          var db = req.result;
          if(!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
        };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ histDbPromise = null; reject(req.error); };
      });
      return histDbPromise;
    }
    function histSave(kind, title, summary, text){
      if(!histEnabled()) return;
      var entry = p6SanitizeEntry({ ts: Date.now(), kind: kind, title: title, summary: summary, text: text }, histTextAllowed());
      histDb().then(function(db){
        var tx = db.transaction("entries", "readwrite");
        tx.objectStore("entries").add(entry);
      }).catch(function(){ /* riwayat gagal diam-diam: analisis tidak boleh terganggu */ });
    }
    var histDetTimer = null, histDetPending = null;
    function histSaveDetector(finalPct, blended){
      if(!histEnabled()) return;
      histDetPending = { scorePct: finalPct, blended: blended, text: lastText };
      if(histDetTimer) clearTimeout(histDetTimer);
      histDetTimer = setTimeout(function(){
        var p = histDetPending; histDetPending = null;
        if(!p || !p.text) return;
        histSave("detector", histTitleOf(p.text), { scorePct: p.scorePct, blended: p.blended, words: wordsOf(p.text).length }, p.text);
      }, 2500);
    }
    function histAll(){
      return histDb().then(function(db){
        return new Promise(function(resolve, reject){
          var out = [];
          var req = db.transaction("entries", "readonly").objectStore("entries").openCursor(null, "prev");
          req.onsuccess = function(){
            var c = req.result;
            if(c){ out.push(Object.assign({ id: c.key }, c.value)); c.continue(); }
            else resolve(out);
          };
          req.onerror = function(){ reject(req.error); };
        });
      });
    }
    function histDeleteOne(id){
      return histDb().then(function(db){
        return new Promise(function(resolve){
          var tx = db.transaction("entries", "readwrite");
          tx.objectStore("entries").delete(id);
          tx.oncomplete = function(){ resolve(); };
          tx.onerror = function(){ resolve(); };
        });
      });
    }
    function histWipe(){
      return histDb().then(function(db){
        return new Promise(function(resolve){
          var tx = db.transaction("entries", "readwrite");
          tx.objectStore("entries").clear();
          tx.oncomplete = function(){ resolve(); };
          tx.onerror = function(){ resolve(); };
        });
      });
    }
    var HIST_KIND_LABEL = { detector: "Periksa Tulisan", forensik: "Analisis Forensik Tulisan", compare: "Bandingkan Tulisan", batch: "Periksa Banyak Dokumen" };
    function histSummaryLine(e){
      var s = e.summary || {}, parts = [];
      if(e.kind === "detector") parts.push("Skor " + s.scorePct + "%" + (s.blended ? " (diperkuat classifier)" : "") + " · " + fmtNumID(s.words || 0) + " kata");
      else if(e.kind === "forensik") parts.push(fmtNumID(s.words || 0) + " kata" + (s.ttrPct != null ? " · TTR " + String(s.ttrPct).replace(".", ",") + "%" : ""));
      else if(e.kind === "compare") parts.push("Kemiripan " + String(s.similarityPct).replace(".", ",") + "% · " + fmtNumID(s.wordsA || 0) + " vs " + fmtNumID(s.wordsB || 0) + " kata");
      else if(e.kind === "batch") parts.push((s.ok || 0) + " berhasil, " + (s.err || 0) + " gagal dari " + (s.total || 0) + " berkas");
      if(e.text) parts.push("teks tersimpan" + (e.textTruncated ? " (terpotong)" : ""));
      else parts.push("tanpa teks");
      return parts.join(" · ");
    }
    function histRenderState(){
      var on = histEnabled(), tx = histTextAllowed();
      var c1 = $("hist-c1"), c2 = $("hist-c2");
      if(c1) c1.checked = on;
      if(c2) c2.checked = tx;
      var st = $("hist-state");
      if(st) st.textContent = on ? ("Riwayat AKTIF — " + (tx ? "metadata + teks disimpan." : "hanya metadata yang disimpan.")) : "Riwayat NONAKTIF — tidak ada yang disimpan.";
      if(navigator.storage && navigator.storage.estimate){
        navigator.storage.estimate().then(function(est){
          var u = $("hist-usage");
          if(u && typeof est.usage === "number") u.textContent = "Perkiraan pemakaian penyimpanan situs ini di peramban: " + p6FmtBytes(est.usage) + " (termasuk cache model, bukan hanya riwayat).";
        }).catch(function(){});
      }
      p6DashStorage();
    }
    function histRenderList(){ histRenderListRun(false); }
    function histRenderListRun(isRetry){
      var box = $("hist-list"), status = $("hist-list-status");
      if(!box) return;
      if(!histEnabled()){ box.innerHTML = "<p class=\"wf-note\">Riwayat nonaktif. Aktifkan lewat persetujuan di atas untuk mulai menyimpan hasil analisis di perangkat ini.</p>"; if(status) status.textContent = ""; return; }
      histAll().then(function(entries){
        if(status) status.textContent = entries.length + " entri.";
        if(!entries.length){
          box.innerHTML = "<p class=\"wf-note\">Belum ada entri. Jalankan analisis apa pun — hasilnya akan tersimpan di sini selama riwayat aktif.</p>";
          if(!isRetry){
            /* Simpanan detektor berjalan dengan jeda singkat (menunggu skor
               akhir tergabung); bila daftar terbaca masih kosong, baca ulang
               satu kali secara otomatis agar entri yang baru tersimpan tidak
               terlewat tampil. */
            var tunggu = histDetPending ? 3000 : 1200;
            setTimeout(function(){ histRenderListRun(true); }, tunggu);
          }
          return;
        }
        box.innerHTML = entries.map(function(e){
          var d = new Date(e.ts);
          return "<div class=\"hist-row\" data-hist-id=\"" + e.id + "\">" +
            "<div class=\"hist-head\"><span><span class=\"p6-chip run\">" + escapeHtml(HIST_KIND_LABEL[e.kind] || e.kind) + "</span> <span class=\"hist-title\">" + escapeHtml(e.title) + "</span></span>" +
            "<span class=\"bq-meta\">" + escapeHtml(d.toLocaleString("id-ID")) + "</span></div>" +
            "<div class=\"hist-sum\">" + escapeHtml(histSummaryLine(e)) + "</div>" +
            "<div class=\"hist-btns\"><button type=\"button\" class=\"btn-ghost\" data-hist-act=\"open\">Buka</button>" +
            "<button type=\"button\" class=\"btn-ghost\" data-hist-act=\"dl\">Unduh JSON</button>" +
            "<button type=\"button\" class=\"btn-ghost\" data-hist-act=\"del\">Hapus</button></div>" +
            "<div class=\"hist-detail\" hidden></div></div>";
        }).join("");
        box._entries = entries;
      }).catch(function(){
        box.innerHTML = "<p class=\"wf-note\">Daftar riwayat tidak dapat dibaca (IndexedDB tidak tersedia?).</p>";
      });
    }
    function histRenderAll(){ histRenderState(); histRenderList(); }
    function p6DashStorage(){
      var on = histEnabled();
      var a = $("dash-hist-state"); if(a) a.textContent = on ? "aktif" : "nonaktif";
      var b = $("dash-storage-state");
      if(b) b.textContent = on ? (histTextAllowed() ? "Riwayat aktif — metadata & teks, atas persetujuan Anda" : "Riwayat aktif — hanya metadata, atas persetujuan Anda") : "Tidak ada teks yang disimpan";
    }
    (function initHistory(){
      var en = $("hist-enable");
      if(en) en.addEventListener("click", function(){
        var c1 = $("hist-c1").checked, c2 = $("hist-c2").checked;
        try {
          if(c1){ localStorage.setItem(HIST_LS_ON, "1"); if(c2) localStorage.setItem(HIST_LS_TEXT, "1"); else localStorage.removeItem(HIST_LS_TEXT); }
          else { localStorage.removeItem(HIST_LS_ON); localStorage.removeItem(HIST_LS_TEXT); }
        } catch(e){}
        if(c1) histDb().catch(function(){});
        histRenderAll();
      });
      var dis = $("hist-disable");
      if(dis) dis.addEventListener("click", function(){
        if(!confirm("Nonaktifkan riwayat? Penanda persetujuan akan dihapus dari perangkat ini.")) return;
        var wipe = confirm("Hapus juga seluruh data riwayat yang sudah tersimpan?\\n\\nOK = nonaktifkan DAN hapus data.\\nBatal = nonaktifkan saja, data lama tetap tersimpan (tetapi tidak ditambah).");
        try { localStorage.removeItem(HIST_LS_ON); localStorage.removeItem(HIST_LS_TEXT); } catch(e){}
        if(wipe){ histWipe().then(function(){ histRenderAll(); }).catch(function(){ histRenderAll(); }); }
        else histRenderAll();
      });
      var ref = $("hist-refresh"); if(ref) ref.addEventListener("click", histRenderList);
      var delAll = $("hist-del-all");
      if(delAll) delAll.addEventListener("click", function(){
        if(!histEnabled()) return;
        if(!confirm("Hapus SELURUH entri riwayat di perangkat ini? Tindakan ini tidak dapat dibatalkan.")) return;
        histWipe().then(histRenderList).catch(function(){});
      });
      var cc = $("hist-clear-cache");
      if(cc) cc.addEventListener("click", function(){
        var st = $("hist-cache-status");
        if(!window.caches){ if(st) st.textContent = "Penyimpanan model peramban tidak tersedia di peramban ini."; return; }
        caches.delete("saksara-clf-v1").then(function(had){
          if(st) st.textContent = had ? "Model penguat skor tersimpan dihapus. Model akan diunduh ulang bila Anda mengaktifkannya lagi." : "Tidak ada model penguat skor yang tersimpan.";
          if(typeof dashClfRefresh === "function") dashClfRefresh();
        }).catch(function(){ if(st) st.textContent = "Penghapusan cache gagal."; });
      });
      var list = $("hist-list");
      if(list) list.addEventListener("click", function(ev){
        var btn = ev.target && ev.target.closest ? ev.target.closest("[data-hist-act]") : null;
        if(!btn) return;
        var row = btn.closest("[data-hist-id]");
        var id = Number(row.getAttribute("data-hist-id"));
        var entries = list._entries || [];
        var e = null;
        entries.forEach(function(x){ if(x.id === id) e = x; });
        if(!e) return;
        var act = btn.getAttribute("data-hist-act");
        if(act === "del"){
          if(!confirm("Hapus entri ini?")) return;
          histDeleteOne(id).then(histRenderList).catch(function(){});
        } else if(act === "dl"){
          var blob = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "saksara-riwayat-" + e.id + ".json";
          document.body.appendChild(a); a.click();
          setTimeout(function(){ URL.revokeObjectURL(a.href); if(a.remove) a.remove(); }, 400);
        } else if(act === "open"){
          var det = row.querySelector(".hist-detail");
          if(!det.hidden){ det.hidden = true; btn.textContent = "Buka"; return; }
          var html = "<p class=\"wf-note\">Ringkasan: " + escapeHtml(histSummaryLine(e)) + "</p>";
          if(e.text){
            html += "<pre>" + escapeHtml(e.text.slice(0, 4000)) + (e.text.length > 4000 ? "\\n… (pratinjau dipotong; unduh JSON untuk teks lengkap yang tersimpan)" : "") + "</pre>";
            if(e.kind === "detector") html += "<div class=\"hist-btns\"><button type=\"button\" class=\"btn-primary\" data-hist-load=\"" + e.id + "\">Muat teks ini ke Detector</button></div>";
          } else {
            html += "<p class=\"wf-note\">Teks dokumen tidak disimpan untuk entri ini (persetujuan teks tidak aktif saat analisis berjalan) — yang tersimpan hanya metadata di atas.</p>";
          }
          det.innerHTML = html;
          det.hidden = false;
          btn.textContent = "Tutup";
          var loadBtn = det.querySelector("[data-hist-load]");
          if(loadBtn) loadBtn.addEventListener("click", function(){
            $("input-teks").value = e.text;
            if(typeof updateCounters === "function") updateCounters();
            window.location.hash = "#/detector";
            if(typeof runAnalysis === "function") runAnalysis();
          });
        }
      });
      p6DashStorage();
      if((window.location.hash || "").indexOf("/history") >= 0) histRenderAll();
    })();

    /* ---------------- Batch 2.0: antrean, ringkasan, ekspor ---------------- */
    var batchQueue = [];
    var batchCancel = false;
    function buildBatchQueue(){
      var input = $("batch-input");
      var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
      var v = p6ValidateBatch(files.map(function(f){ return { name: f.name, size: f.size }; }));
      var rejectedByName = {};
      v.rejected.forEach(function(r){ rejectedByName[r.name] = r.reason; });
      batchQueue = files.map(function(f){
        if(rejectedByName[f.name]) return { file: f, name: f.name, size: f.size, status: "invalid", reason: rejectedByName[f.name] };
        return { file: f, name: f.name, size: f.size, status: "wait", reason: "" };
      });
      var note = $("batch-queue-note");
      if(note){
        if(!files.length) note.textContent = "";
        else if(v.rejected.length) note.textContent = v.rejected.length + " berkas ditolak dari antrean: " + v.rejected.map(function(r){ return r.name + " (" + r.reason + ")"; }).join("; ");
        else note.textContent = files.length + " berkas dalam antrean (" + p6FmtBytes(v.totalBytes) + " total).";
      }
      renderBatchQueue();
    }
    var BQ_LABEL = { wait: ["Menunggu", ""], invalid: ["Tidak valid", "err"], run: ["Memproses", "run"], ok: ["Selesai", "ok"], err: ["Gagal", "err"], cancel: ["Dibatalkan", ""] };
    function renderBatchQueue(){
      var box = $("batch-queue");
      if(!box) return;
      if(!batchQueue.length){ box.innerHTML = ""; return; }
      box.innerHTML = batchQueue.map(function(q, i){
        var lb = BQ_LABEL[q.status] || [q.status, ""];
        var right = "<span class=\"p6-chip " + lb[1] + "\">" + lb[0] + "</span>";
        if(q.status === "wait" && !batchBusy) right += " <button type=\"button\" class=\"btn-ghost\" data-bq-del=\"" + i + "\">Hapus</button>";
        var meta = p6FmtBytes(q.size) + (q.reason ? " — " + escapeHtml(q.reason) : "");
        return "<div class=\"bq-row\"><span><span class=\"bq-name\">" + escapeHtml(q.name) + "</span><br /><span class=\"bq-meta\">" + meta + "</span></span><span>" + right + "</span></div>";
      }).join("");
    }
    function renderBatchSummary(){
      var box = $("batch-summary");
      if(!box) return;
      if(!batchRows.length){ box.innerHTML = ""; return; }
      var s = p6BatchSummary(batchRows);
      var meanTxt = s.mean == null ? "—" : (Math.round(s.mean * 1000) / 10).toString().replace(".", ",") + "%";
      var medTxt = s.median == null ? "—" : (Math.round(s.median * 1000) / 10).toString().replace(".", ",") + "%";
      box.innerHTML = "<div class=\"wf-cards\">" +
        "<div class=\"wf-stat\"><b>" + s.ok + "/" + s.total + "</b><span>berkas berhasil dinilai</span></div>" +
        "<div class=\"wf-stat\"><b>" + meanTxt + "</b><span>rata-rata skor</span></div>" +
        "<div class=\"wf-stat\"><b>" + medTxt + "</b><span>median skor</span></div>" +
        "<div class=\"wf-stat\"><b>" + s.bands.RENDAH + " / " + s.bands.SEDANG + " / " + s.bands.TINGGI + "</b><span>berkas RENDAH / SEDANG / TINGGI</span></div>" +
        "</div>" + (s.err ? "<p class=\"wf-note\">" + s.err + " berkas gagal — alasannya tercantum pada tabel; gunakan \\\"Coba Lagi yang Gagal\\\" untuk memproses ulang hanya berkas tersebut.</p>" : "");
    }
    (function initBatch6(){
      var input = $("batch-input");
      if(input) input.addEventListener("change", buildBatchQueue);
      var q = $("batch-queue");
      if(q) q.addEventListener("click", function(ev){
        var b = ev.target && ev.target.closest ? ev.target.closest("[data-bq-del]") : null;
        if(!b) return;
        batchQueue.splice(Number(b.getAttribute("data-bq-del")), 1);
        renderBatchQueue();
      });
      var cancel = $("btn-batch-cancel");
      if(cancel) cancel.addEventListener("click", function(){ batchCancel = true; setBatchProgress("Membatalkan — berkas yang sedang berjalan diselesaikan, sisanya dilewati…"); });
      var retry = $("btn-batch-retry");
      if(retry) retry.addEventListener("click", function(){
        batchRows = batchRows.filter(function(r){ return !r.error; });
        renderBatchTable();
        processBatch(true);
      });
      var jb = $("btn-batch-json");
      if(jb) jb.addEventListener("click", function(){
        if(!batchRows.length) return;
        var payload = { generatedAt: new Date().toISOString(), engine: "Ensemble Heuristik v3 (+ classifier bila aktif)", summary: p6BatchSummary(batchRows), rows: batchRows };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "saksara-batch.json";
        document.body.appendChild(a); a.click();
        setBatchProgress("Berkas JSON hasil batch sudah diunduh.");
        setTimeout(function(){ URL.revokeObjectURL(a.href); if(a.remove) a.remove(); }, 400);
      });
      var pb = $("btn-batch-pdf");
      if(pb) pb.addEventListener("click", downloadBatchPdf);
    })();

    /* ---------------- Report 2.0: kit bersama ---------------- */
    function p6PdfKit(jsPDF, title){
      var doc = new jsPDF({ unit: "mm", format: "a4" });
      var W = 210, M = 16, y = 18, lh = 5.6;
      function line(txt, size, bold){
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size || 10.5);
        doc.setTextColor(0);
        var parts = doc.splitTextToSize(pdfSafe(txt), W - 2 * M);
        parts.forEach(function(p){
          if(y > 278){ doc.addPage(); y = 18; }
          doc.text(p, M, y);
          y += lh;
        });
      }
      function gap(h){ y += (h || 3); }
      function head(){
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(29, 95, 209);
        doc.text("Saksara", M, y); y += 8;
        doc.setTextColor(0);
        line(title, 13, true);
        line("Dibuat lokal di peramban · " + new Date().toLocaleString("id-ID") + " · saksara.vercel.app", 9.5);
        gap(1);
        doc.setDrawColor(160); doc.line(M, y, W - M, y); gap(5);
      }
      function stamp(){
        var n = doc.getNumberOfPages();
        for(var i = 1; i <= n; i++){
          doc.setPage(i);
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
          doc.text(pdfSafe("Saksara — laporan dibuat lokal di peramban ini. Skor adalah indikasi statistik, bukan bukti kepengarangan."), M, 290);
          doc.text(i + " / " + n, W - M, 290, { align: "right" });
        }
        doc.setTextColor(0);
      }
      return { doc: doc, line: line, gap: gap, head: head, stamp: stamp,
               getY: function(){ return y; }, setY: function(v){ y = v; }, M: M, W: W };
    }
    async function downloadBatchPdf(){
      if(!batchRows.length) return;
      var btn = $("btn-batch-pdf");
      btn.disabled = true;
      try {
        var jsPDF = await loadJsPdf();
        var k = p6PdfKit(jsPDF, "Laporan Ringkasan Batch — Saksara");
        k.head();
        var s = p6BatchSummary(batchRows);
        k.line("Ringkasan", 12, true);
        k.line("Berkas dinilai: " + s.ok + " dari " + s.total + " (" + s.err + " gagal). Rata-rata skor: " + (s.mean == null ? "—" : (Math.round(s.mean * 1000) / 10) + "%") + " · Median: " + (s.median == null ? "—" : (Math.round(s.median * 1000) / 10) + "%") + ". Distribusi pita: RENDAH " + s.bands.RENDAH + " · SEDANG " + s.bands.SEDANG + " · TINGGI " + s.bands.TINGGI + ".");
        k.gap(2);
        k.line("Per berkas", 12, true);
        batchRows.forEach(function(r){
          if(r.error) k.line("• " + r.name + " — GAGAL: " + r.error, 10);
          else k.line("• " + r.name + " — " + fmtNumID(r.words) + " kata · skor " + pct(r.score) + "% · " + bandLabelID(r.score) + " · kalimat terindikasi " + r.indicatedPct + "%", 10);
        });
        k.gap(2);
        k.line("Metodologi & keterbatasan", 12, true);
        k.line("Setiap berkas dinilai dengan Ensemble Heuristik v3 yang sama dengan Detector (tujuh sinyal statistik); bila Penguat AI (classifier) sedang aktif di peramban, penguat bersyarat yang sama ikut diterapkan. Berkas diproses berurutan, sepenuhnya lokal. Skor adalah indikasi statistik atas pola tulisan — bukan bukti kepengarangan, bukan dasar vonis akademik. Teks pendek (di bawah ±300 kata) kurang dapat dipegang; parafrase AI dapat lolos dari kedua lapis.");
        k.stamp();
        k.doc.save("saksara-batch.pdf");
        setBatchProgress("PDF ringkasan batch sudah diunduh.");
      } catch(e){
        setBatchProgress("Laporan PDF gagal dibuat: " + (e && e.message ? e.message : e));
      }
      btn.disabled = false;
    }
    var wfLastRun = null;
    async function downloadWfPdf(){
      var st = $("wf-file-status");
      if(!wfLastRun){ if(st) st.textContent = "Jalankan Analisis Karakteristik terlebih dahulu, lalu unduh laporannya."; return; }
      var btn = $("wf-pdf");
      btn.disabled = true;
      try {
        var jsPDF = await loadJsPdf();
        var k = p6PdfKit(jsPDF, "Laporan Writing Forensic — Saksara");
        k.head();
        var S = wfLastRun.st;
        k.line("Ringkasan dokumen", 12, true);
        k.line(fmtNumID(S.words) + " kata · " + fmtNumID(S.sents) + " kalimat · " + fmtNumID(S.paras) + " paragraf · " + fmtNumID(S.unique) + " kata unik.");
        k.gap(2);
        k.line("Metrik karakteristik", 12, true);
        var rows = document.querySelectorAll("#wf-results table tbody tr");
        if(rows.length){
          rows.forEach(function(tr){
            var tds = tr.querySelectorAll("td");
            if(tds.length >= 2) k.line("• " + tds[0].textContent.trim() + ": " + tds[1].textContent.trim(), 10);
          });
        } else {
          k.line("• TTR: " + (S.lex ? (Math.round(S.lex.ttr * 1000) / 10) + "%" : "—") + " · Kata transisi: " + (S.transPer100 != null ? S.transPer100 + " per 100 kata" : "—"), 10);
        }
        k.gap(2);
        k.line("Saran penyuntingan", 12, true);
        var lis = document.querySelectorAll("#wf-suggest li");
        if(lis.length) lis.forEach(function(li){ k.line("• " + li.textContent.trim(), 10); });
        else k.line("Tidak ada saran yang terpicu pada ambang aturan saat ini.", 10);
        k.gap(2);
        k.line("Metodologi & keterbatasan", 12, true);
        k.line("Writing Forensic menghitung statistik deskriptif tulisan (keragaman kosakata, distribusi panjang kalimat, konsistensi paragraf, kata transisi, pengulangan) sepenuhnya di peramban. Modul ini BUKAN detektor AI: angka-angkanya bukan bukti siapa penulisnya dan tidak memengaruhi skor Detector. Keragaman rendah atau ritme seragam dapat muncul pada tulisan manusia yang formal; teks di bawah ±300 kata menghasilkan statistik yang mudah berayun.");
        k.stamp();
        k.doc.save("saksara-forensik.pdf");
      } catch(e){
        if(st) st.textContent = "Laporan PDF gagal dibuat: " + (e && e.message ? e.message : e);
      }
      btn.disabled = false;
    }
    (function initWfPdf(){
      var b = $("wf-pdf");
      if(b) b.addEventListener("click", downloadWfPdf);
    })();

    /* ---------------- OCR (Tesseract.js + pdf.js, opt-in) ---------------- */
    var ocrPendingFile = null;
    var ocrState = { ready: false, enabling: false, worker: null, file: null, isPdf: false, pdfDoc: null, pageCount: 0, imgCanvas: null, busy: false, cancel: false };
    var OCR_TESS_JS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js";
    var OCR_TESS_WORKER = "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/worker.min.js";
    var OCR_TESS_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0";
    var OCR_TESS_LANG = "https://tessdata.projectnaptha.com/4.0.0_fast";
    /* D7-B: PDF.js 4.10.38 build legacy (.mjs) — dimuat lewat pemuat
       bersama saksaraLoadPdfJs (dynamic import), BUKAN <script> klasik.
       Nama konstanta dipertahankan karena dipakai kedua fitur. */
    var OCR_PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs";
    var OCR_PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
    function ocrStatus(msg){ var el = $("ocr-enable-status"); if(el) el.textContent = msg; }
    function ocrProgress(msg, frac){
      var p = $("ocr-progress"); if(p) p.textContent = msg;
      var f = $("ocr-bar-fill"); if(f && typeof frac === "number") f.style.width = Math.round(frac * 100) + "%";
    }
    async function ocrEnsureWorker(){
      if(ocrState.worker) return ocrState.worker;
      ocrState.worker = await Tesseract.createWorker("ind+eng", 1, {
        workerPath: OCR_TESS_WORKER, corePath: OCR_TESS_CORE, langPath: OCR_TESS_LANG,
        logger: function(m){
          if(ocrState.busy && m.status === "recognizing text"){
            var base = ocrState._pageBase || 0, total = ocrState._pageTotal || 1;
            ocrProgress("Mengenali halaman " + (base + 1) + " dari " + total + " — " + Math.round(m.progress * 100) + "%", (base + m.progress) / total);
          }
        }
      });
      return ocrState.worker;
    }
    async function ocrEnable(){
      if(ocrState.ready || ocrState.enabling) return;
      ocrState.enabling = true;
      var btn = $("ocr-enable"); if(btn) btn.disabled = true;
      try {
        ocrStatus("Mengunduh pustaka OCR…");
        if(!window.Tesseract) await p6LoadScript(OCR_TESS_JS);
        if(!window.pdfjsLib) await saksaraLoadPdfJs();
        ocrStatus("Mengunduh model bahasa (Indonesia + Inggris) & menyiapkan mesin…");
        await ocrEnsureWorker();
        ocrState.ready = true;
        ocrStatus("OCR aktif — unduhan tersimpan di cache peramban; pengenalan berjalan lokal.");
        $("ocr-work").hidden = false;
        if(ocrPendingFile){ var f = ocrPendingFile; ocrPendingFile = null; ocrSetFile(f); }
      } catch(e){
        ocrStatus("Pengaktifan gagal: " + (e && e.message ? e.message : e) + " — periksa koneksi internet lalu coba lagi.");
        if(btn) btn.disabled = false;
      }
      ocrState.enabling = false;
    }
    async function ocrSetFile(f){
      var st = $("ocr-file-status");
      ocrState.file = f; ocrState.pdfDoc = null; ocrState.isPdf = false; ocrState.pageCount = 0; ocrState.imgCanvas = null;
      $("ocr-pages-wrap").hidden = true;
      if(!f){ if(st) st.textContent = ""; return; }
      if(typeof f.size === "number" && f.size > MAX_FILE_BYTES){ if(st) st.textContent = "Berkas terlalu besar — batas 20 MB."; ocrState.file = null; return; }
      var lower = (f.name || "").toLowerCase();
      try {
        if(lower.endsWith(".pdf")){
          var buf = await f.arrayBuffer();
          var doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
          ocrState.isPdf = true; ocrState.pdfDoc = doc; ocrState.pageCount = doc.numPages;
          $("ocr-pages-wrap").hidden = false;
          $("ocr-page-controls").hidden = false;
          $("ocr-page-info").textContent = "PDF berisi " + doc.numPages + " halaman. Maksimum 20 halaman diproses per giliran. Pratinjau = halaman pertama yang dipilih.";
          if(st) st.textContent = "Berkas dimuat: " + f.name + " (" + doc.numPages + " halaman).";
          await ocrRenderPreview();
        } else {
          var bmp = await createImageBitmap(f);
          var cv = document.createElement("canvas");
          var scale = Math.min(1, 1600 / bmp.width);
          cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
          cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
          ocrState.imgCanvas = cv;
          $("ocr-pages-wrap").hidden = false;
          $("ocr-page-controls").hidden = true;
          $("ocr-page-info").textContent = "Satu gambar (" + bmp.width + " × " + bmp.height + " px).";
          var pv = $("ocr-preview");
          pv.width = cv.width; pv.height = cv.height;
          pv.getContext("2d").drawImage(cv, 0, 0);
          if(st) st.textContent = "Berkas dimuat: " + f.name + ".";
        }
      } catch(e){
        if(st) st.textContent = "Berkas tidak dapat dibuka: " + (e && e.message ? e.message : e);
        ocrState.file = null;
      }
    }
    function ocrSelectedPages(){
      if(!ocrState.isPdf) return [1];
      var all = $("ocr-page-all").checked;
      var raw = ($("ocr-page-list").value || "").trim();
      var pages = [];
      if(all || !raw){
        for(var i = 1; i <= ocrState.pageCount; i++) pages.push(i);
      } else {
        raw.split(",").forEach(function(x){
          var n = parseInt(x, 10);
          if(n >= 1 && n <= ocrState.pageCount && pages.indexOf(n) < 0) pages.push(n);
        });
        pages.sort(function(a, b){ return a - b; });
      }
      return pages.slice(0, 20);
    }
    async function ocrRenderPreview(){
      if(!ocrState.isPdf || !ocrState.pdfDoc) return;
      var pages = ocrSelectedPages();
      if(!pages.length) return;
      var page = await ocrState.pdfDoc.getPage(pages[0]);
      var viewport = page.getViewport({ scale: 1.4 });
      var pv = $("ocr-preview");
      pv.width = viewport.width; pv.height = viewport.height;
      await page.render({ canvasContext: pv.getContext("2d"), viewport: viewport }).promise;
    }
    async function ocrRun(){
      if(ocrState.busy) return;
      if(!ocrState.ready){ ocrStatus("Aktifkan OCR terlebih dahulu."); return; }
      if(!ocrState.file){ $("ocr-file-status").textContent = "Pilih berkas terlebih dahulu."; return; }
      ocrState.busy = true; ocrState.cancel = false;
      $("ocr-run").disabled = true; $("ocr-cancel").disabled = false;
      var confEl = $("ocr-conf"); if(confEl) confEl.textContent = "";
      try {
        var worker = await ocrEnsureWorker();
        var results = [];
        if(ocrState.isPdf){
          var pages = ocrSelectedPages();
          ocrState._pageTotal = pages.length;
          for(var i = 0; i < pages.length; i++){
            if(ocrState.cancel) break;
            ocrState._pageBase = i;
            ocrProgress("Merender halaman " + pages[i] + "…", i / pages.length);
            var page = await ocrState.pdfDoc.getPage(pages[i]);
            var viewport = page.getViewport({ scale: 2 });
            var cv = document.createElement("canvas");
            cv.width = viewport.width; cv.height = viewport.height;
            await page.render({ canvasContext: cv.getContext("2d"), viewport: viewport }).promise;
            var out = await worker.recognize(cv);
            results.push({ page: pages[i], text: out.data.text || "", confidence: out.data.confidence || 0, words: wordsOf(out.data.text || "").length });
          }
        } else {
          ocrState._pageTotal = 1; ocrState._pageBase = 0;
          var out1 = await worker.recognize(ocrState.file);
          results.push({ page: 1, text: out1.data.text || "", confidence: out1.data.confidence || 0, words: wordsOf(out1.data.text || "").length });
        }
        var agg = p6OcrAggregate(results);
        $("ocr-out").value = results.map(function(r){ return r.text.trim(); }).filter(Boolean).join("\n\n");
        var msg = "Selesai: " + results.length + " halaman, " + fmtNumID(agg.totalWords) + " kata terbaca, kepercayaan rata-rata " + String(agg.meanConfidence).replace(".", ",") + "%.";
        if(agg.emptyPages.length) msg += " Halaman tanpa kata terbaca: " + agg.emptyPages.join(", ") + ".";
        if(agg.lowPages.length) msg += " PERINGATAN: kepercayaan rendah (< 60%) pada halaman " + agg.lowPages.join(", ") + " — hasilnya mungkin banyak kesalahan; periksa dengan saksama.";
        if(ocrState.cancel) msg = "Dibatalkan. " + msg;
        if(confEl) confEl.textContent = msg;
        ocrProgress(ocrState.cancel ? "OCR dibatalkan." : "OCR selesai.", 1);
      } catch(e){
        if(confEl) confEl.textContent = "OCR gagal: " + (e && e.message ? e.message : e);
        ocrProgress("OCR gagal.", 0);
      }
      ocrState.busy = false;
      $("ocr-run").disabled = false; $("ocr-cancel").disabled = true;
    }
    (function initOcr(){
      var en = $("ocr-enable"); if(en) en.addEventListener("click", ocrEnable);
      var fi = $("ocr-file"); if(fi) fi.addEventListener("change", function(){ if(fi.files && fi.files[0]) ocrSetFile(fi.files[0]); });
      var run = $("ocr-run"); if(run) run.addEventListener("click", ocrRun);
      var cancel = $("ocr-cancel");
      if(cancel) cancel.addEventListener("click", function(){
        ocrState.cancel = true;
        if(ocrState.worker){ ocrState.worker.terminate(); ocrState.worker = null; }
        ocrProgress("Membatalkan…", 0);
      });
      var pa = $("ocr-page-all"); if(pa) pa.addEventListener("change", ocrRenderPreview);
      var pl = $("ocr-page-list"); if(pl) pl.addEventListener("change", ocrRenderPreview);
      var cp = $("ocr-copy");
      if(cp) cp.addEventListener("click", function(){
        var t = $("ocr-out").value;
        if(navigator.clipboard && t) navigator.clipboard.writeText(t);
      });
      var dl = $("ocr-dl");
      if(dl) dl.addEventListener("click", function(){
        var blob = new Blob([$("ocr-out").value], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "saksara-ocr.txt";
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(a.href); if(a.remove) a.remove(); }, 400);
      });
      var td = $("ocr-to-detector");
      if(td) td.addEventListener("click", function(){
        var t = $("ocr-out").value;
        if(!t.trim()){ $("ocr-conf").textContent = "Hasil OCR masih kosong."; return; }
        $("input-teks").value = t;
        if(typeof updateCounters === "function") updateCounters();
        window.location.hash = "#/detector";
        if(typeof runAnalysis === "function") runAnalysis();
      });
      document.addEventListener("click", function(ev){
        var b = ev.target && ev.target.closest ? ev.target.closest("[data-ocr-open]") : null;
        if(!b) return;
        window.location.hash = "#/ocr";
        if(ocrState.ready && ocrPendingFile){ var f = ocrPendingFile; ocrPendingFile = null; ocrSetFile(f); }
        else if(!ocrState.ready){ ocrStatus("Berkas Anda sudah disiapkan — aktifkan OCR dengan tombol di atas, berkas akan dimuat otomatis sesudahnya."); }
      });
    })();
    window.addEventListener("hashchange", function(){
      var h = window.location.hash || "";
      if(h.indexOf("/history") >= 0) histRenderAll();
      if(h.indexOf("/ocr") >= 0 && ocrState.ready && ocrPendingFile){ var f = ocrPendingFile; ocrPendingFile = null; ocrSetFile(f); }
    });


    /* ---------------- Phase 7: lapisan bahasa manusia (presentasi murni) ----------------
       Blok ini TIDAK menyentuh fungsi penilaian apa pun. Ia hanya menerjemahkan
       hasil yang sudah dihitung menjadi bahasa sederhana, dan mengatur
       Tampilan Sederhana/Mendalam lewat kelas pada <body> (status hanya di
       memori sesi — tidak ada penyimpanan baru). */
    var p7LastFinal = null;
    function p7Conclusion(score){
      p7LastFinal = score;
      var card = $("human-card"); if(!card) return;
      var title, explain, tip;
      if(score < 0.35){
        title = "Indikasi pola AI rendah pada tulisan ini";
        explain = "Pemeriksa menemukan sedikit pola yang biasanya muncul pada teks AI: pola kalimat, pilihan kata, dan ritme tulisan ini beragam dan tidak menunjukkan pola khas teks AI yang berarti. Artinya, keyakinan analisis terhadap adanya pola AI pada teks ini rendah — hasil ini menyatakan indikasi yang ditemukan, bukan siapa penulisnya.";
        tip = "Yang bisa Anda lakukan: dari sisi pola, tidak ada indikasi kuat yang perlu dikhawatirkan. Tetap baca isinya seperti biasa — skor rendah bukan jaminan keaslian, hanya menunjukkan indikasi AI yang ditemukan memang sedikit.";
      } else if(score <= 0.65){
        title = "Indikasi pola AI sedang — sebagian pola menyerupai teks AI";
        explain = "Sebagian pola tulisan ini menyerupai pola yang sering muncul pada teks AI — misalnya kalimat yang sangat seragam atau frasa yang umum dipakai AI — sementara sebagian pola lain tidak menunjukkan ciri tersebut. Tulisan manusia yang sangat formal dan rapi juga bisa menghasilkan indikasi seperti ini, sehingga keyakinan analisis pada tingkat ini memang terbatas.";
        tip = "Yang bisa Anda lakukan: periksa kalimat-kalimat yang ditandai di bawah. Bila ini tulisan Anda, menambahkan contoh nyata dan memvariasikan panjang kalimat biasanya membuatnya terasa lebih hidup.";
      } else {
        title = "Indikasi pola AI kuat pada tulisan ini";
        explain = "Analisis menemukan banyak pola yang menyerupai keluaran AI: ritme kalimat yang seragam dan/atau frasa formulaik yang berulang. Indikasi yang kuat seperti ini adalah alasan yang baik untuk meninjau isinya lebih lanjut — tetapi tetap bukan bukti siapa penulisnya.";
        tip = "Yang bisa Anda lakukan: tinjau kalimat yang ditandai, tulis ulang bagian yang bukan gaya Anda dengan kata-kata sendiri, dan tambahkan pengalaman atau contoh konkret bila ini karya Anda.";
      }
      if(lastWatchSignal){
        explain += " Catatan: alat pembanding otomatis kami memberi sinyal sangat kuat pada teks ini walaupun pola statistiknya rendah — sebaiknya teks ini ditinjau manusia sebelum disimpulkan.";
      }
      $("human-title").textContent = title;
      $("human-explain").textContent = explain;
      $("human-tip").textContent = tip;
      card.hidden = false;
    }
    function p7WfFriendly(st){
      var box = $("wf-friendly"); if(!box) return;
      function esc(x){ return escapeHtml(String(x)); }
      var ritme = st.lensCv >= 0.55 ? "bervariasi — campuran kalimat pendek dan panjang" : (st.lensCv >= 0.35 ? "cukup bervariasi" : "cenderung seragam — kalimat-kalimatnya berukuran mirip");
      var ritmeTip = st.lensCv >= 0.35 ? "Ritme seperti ini umumnya nyaman dibaca." : "Bila terasa monoton, selingi kalimat panjang dengan kalimat pendek yang tegas.";
      var kataTip = st.ttrWin >= 0.6 ? "Pilihan kata yang beragam membantu pembaca tetap tertarik." : "Bila kata yang sama muncul berulang kali, coba sinonimnya atau ganti dengan contoh yang konkret.";
      var hubTip = st.transPer100 >= 2.5 ? "Kata penghubung yang terlalu sering bisa membuat tulisan terasa seperti templat — kadang kalimat lebih kuat bila langsung dimulai dari isinya." : "Pemakaian kata penghubung tergolong hemat.";
      var cards = [
        ["Sekilas isi teks", fmtNumID(st.words) + " kata",
         "Teks ini terdiri dari " + fmtNumID(st.words) + " kata, tersusun dalam " + fmtNumID(st.sents) + " kalimat dan " + fmtNumID(st.paras) + " paragraf.",
         "Semakin panjang teks, semakin stabil gambaran gayanya."],
        ["Ritme kalimat", ritme,
         "Rata-rata satu kalimat berisi " + wfFmt(st.lensMean) + " kata. Ritme kalimat tulisan ini " + ritme + ".",
         ritmeTip],
        ["Keragaman kata", wfPctTxt(st.ttrWin) + " kata berbeda",
         "Dari setiap 50 kata berurutan, rata-rata " + wfFmt(st.ttrWin * 50) + " di antaranya kata yang berbeda. " + (st.ttrWin >= 0.6 ? "Kosakata yang dipakai tergolong beragam." : "Banyak kata yang sama dipakai berulang."),
         kataTip],
        ["Kata penghubung", wfFmt(st.transPer100, 2) + " per 100 kata",
         "Kata penghubung seperti \u201cselain itu\u201d, \u201coleh karena itu\u201d, dan \u201dkesimpulannya\u201d muncul " + fmtNumID(st.transTotal) + " kali di seluruh teks.",
         hubTip]
      ];
      box.innerHTML = cards.map(function(c){
        return "<div class=\"fr-card\"><h4>" + esc(c[0]) + "</h4><div class=\"fr-v\">" + esc(c[1]) + "</div><p>" + esc(c[2]) + "</p><p class=\"fr-s\">" + esc(c[3]) + "</p></div>";
      }).join("");
    }

    var p7QuickText = null, p7QuickFile = null;
    function p7GoDetector(){
      if(p7QuickText !== null){
        var ta = $("input-teks");
        if(ta){ ta.value = p7QuickText; ta.dispatchEvent(new Event("input", { bubbles: true })); }
        p7QuickText = null;
        var b = $("btn-analisis"); if(b) b.click();
      } else if(p7QuickFile){
        var f = p7QuickFile; p7QuickFile = null; handleFile(f);
      }
    }
    function p7NavDetector(){
      if((window.location.hash || "") === "#/detector"){ p7GoDetector(); }
      else { window.location.hash = "#/detector"; setTimeout(p7GoDetector, 350); }
    }
    var p7qg = $("p7-quick-go");
    if(p7qg) p7qg.addEventListener("click", function(){
      var v = ($("p7-quick-text").value || "").trim();
      if(!v){ window.location.hash = "#/detector"; return; }
      p7QuickText = $("p7-quick-text").value;
      p7NavDetector();
    });
    var p7qf = $("p7-quick-file");
    if(p7qf) p7qf.addEventListener("change", function(e){
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if(!f) return;
      p7QuickFile = f;
      p7NavDetector();
    });
    document.addEventListener("click", function(e){
      var t = e.target;
      var b = (t && t.closest) ? t.closest(".mt-btn") : null;
      if(!b) return;
      var deep = b.getAttribute("data-mode") === "deep";
      document.body.classList.toggle("mode-deep", deep);
      var btns = document.querySelectorAll(".mt-btn");
      for(var i = 0; i < btns.length; i++){
        btns[i].setAttribute("aria-pressed", (btns[i].getAttribute("data-mode") === "deep") === deep ? "true" : "false");
      }
    });

    // Router tampilan per halaman (satu berkas): #/home, #/detector, #/cara-kerja, #/metode, #/posisi.
    // Tautan lama (#analisis, #clf-panel, #benchmark, …) tetap didukung lewat peta LEGACY.
    (function(){
      var TITLES = { home: "Saksara — Pahami Tulisan Anda", detector: "Periksa Tulisan — Saksara", forensik: "Kenali Gaya Tulisan — Saksara", tulis: "Asisten Menulis — Saksara", compare: "Bandingkan Tulisan — Saksara", benchmark: "Pengujian & Transparansi — Saksara", ocr: "Baca Teks dari Gambar — Saksara", history: "Riwayat Saya — Saksara", "cara-kerja": "Cara Menggunakan Saksara", metode: "Metode & Pengukuran — Saksara", posisi: "Privasi & Batasan — Saksara" };
      var ROUTES = { "": "home", "/": "home", "/home": "home", "/detector": "detector", "/forensik": "forensik", "/tulis": "tulis", "/compare": "compare", "/benchmark": "benchmark", "/ocr": "ocr", "/history": "history", "/cara-kerja": "cara-kerja", "/metode": "metode", "/posisi": "posisi" };
      var LEGACY = { "analisis": ["detector", "analisis"], "panel-analisis": ["detector", "panel-analisis"], "clf-panel": ["detector", "clf-panel"], "report": ["detector", "report"], "batch": ["detector", "batch"], "cara-kerja": ["cara-kerja", null], "benchmark": ["metode", "benchmark-note"], "posisi": ["posisi", null], "atas": ["home", null] };
      function show(view, anchor){
        var blocks = document.querySelectorAll("[data-view]");
        for(var i = 0; i < blocks.length; i++){ blocks[i].hidden = blocks[i].getAttribute("data-view") !== view; }
        var links = document.querySelectorAll("[data-route]");
        for(var j = 0; j < links.length; j++){
          var on = links[j].getAttribute("data-route") === view;
          links[j].classList.toggle("active", on);
          if(on) links[j].setAttribute("aria-current", "page"); else links[j].removeAttribute("aria-current");
        }
        document.title = TITLES[view] || TITLES.home;
        if(anchor){
          var t = document.getElementById(anchor);
          if(t){ t.scrollIntoView(); return; }
        }
        window.scrollTo(0, 0);
      }
      function route(){
        var h = location.hash.replace(/^#/, "");
        if(Object.prototype.hasOwnProperty.call(ROUTES, h)){ show(ROUTES[h], null); return; }
        if(Object.prototype.hasOwnProperty.call(LEGACY, h)){ show(LEGACY[h][0], LEGACY[h][1]); return; }
        // Hash lain: jangkar di dalam tampilan yang sedang aktif — biarkan perilaku bawaan peramban.
      }
      window.addEventListener("hashchange", route);
      route();
    })();
    /* ================= Editor Kaya Asisten Menulis (D8 Tahap 4) =================
       Permukaan tulis contenteditable bergaya pengolah kata di atas
       tulang punggung teks polos #wi-input. #wi-input TETAP satu-satunya
       sumber kebenaran: setiap alur lama (impor DOCX/PDF, penghitung,
       batas 50.000 karakter, analisis, pemetaan saran, deteksi teks
       berubah, semua ekspor) membaca/menulis #wi-input.value persis
       seperti sebelumnya. Editor hanya permukaan: suntingannya
       diserialkan ke teks polos oleh ED-CORE (kontrak beku di sana)
       dan ditulis ke #wi-input; sebaliknya setiap penulisan
       programatis ke #wi-input.value (impor, reset, alur lain)
       ditangkap lewat kait setter nilai dan digambar ulang ke editor.
       Format (tebal, warna, spasi, indentasi) adalah alat bantu
       menulis untuk teks yang diketik/ditempel di editor — ia tidak
       disimpan di tulang punggung dan tidak digambar ulang dari teks
       polos (impor menggambar paragraf polos). Mode "Teks polos"
       menyembunyikan editor dan menampilkan #wi-input apa adanya:
       perilaku persis seperti sebelum tahap ini. Bila inisialisasi
       gagal di tengah, seluruh tambahan dilepas dan kotak teks lama
       tetap bekerja (blok ini tidak boleh mematahkan halaman). */
    (function(){
      var ta = $("wi-input");
      if(!ta || !ta.parentNode || !window.getSelection || !document.createRange) return;
      var ED_HTML = `
      <div class="wi-ed-mode" role="group" aria-label="Mode kotak teks">
        <button type="button" class="wi-ed-mode-btn is-on" data-wied-mode="editor" aria-pressed="true">Editor</button>
        <button type="button" class="wi-ed-mode-btn" data-wied-mode="plain" aria-pressed="false">Teks polos</button>
      </div>
      <div class="wi-ed-bar" role="toolbar" aria-label="Bilah format teks">
        <button type="button" data-cmd="undo" title="Urungkan">↩</button>
        <button type="button" data-cmd="redo" title="Ulangi">↪</button>
        <span class="wi-ed-sep"></span>
        <select data-wied="style" aria-label="Gaya paragraf" title="Gaya paragraf">
          <option value="" selected>Gaya</option>
          <option value="P">Paragraf</option>
          <option value="H1">Judul 1</option>
          <option value="H2">Judul 2</option>
          <option value="H3">Judul 3</option>
          <option value="BLOCKQUOTE">Kutipan</option>
        </select>
        <select data-wied="font" aria-label="Jenis huruf" title="Jenis huruf">
          <option value="" selected>Huruf</option>
          <option value="'Plus Jakarta Sans', sans-serif">Bawaan (Plus Jakarta Sans)</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Calibri, sans-serif">Calibri</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
        <select data-wied="size" aria-label="Ukuran huruf" title="Ukuran huruf">
          <option value="" selected>Ukuran</option>
          <option value="10">10 pt</option>
          <option value="11">11 pt</option>
          <option value="12">12 pt</option>
          <option value="13">13 pt</option>
          <option value="14">14 pt</option>
          <option value="16">16 pt</option>
          <option value="18">18 pt</option>
          <option value="20">20 pt</option>
          <option value="22">22 pt</option>
          <option value="24">24 pt</option>
        </select>
        <span class="wi-ed-sep"></span>
        <button type="button" data-cmd="bold" title="Tebal" aria-pressed="false"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Miring" aria-pressed="false"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Garis bawah" aria-pressed="false"><u>U</u></button>
        <button type="button" data-cmd="strikeThrough" title="Coret" aria-pressed="false"><s>S</s></button>
        <button type="button" data-cmd="subscript" title="Subskrip (tulis kecil di bawah)" aria-pressed="false">x<sub>2</sub></button>
        <button type="button" data-cmd="superscript" title="Superskrip (tulis kecil di atas)" aria-pressed="false">x<sup>2</sup></button>
        <label class="wi-ed-color" title="Warna teks">A<input type="color" data-wied="fore" value="#14304f" aria-label="Warna teks"></label>
        <label class="wi-ed-color" title="Warna sorotan teks"><span class="wi-ed-hilite-mark">A</span><input type="color" data-wied="hilite" value="#fbeec3" aria-label="Warna sorotan teks"></label>
        <button type="button" data-cmd="removeFormat" title="Hapus format pada teks/blok terpilih">Hapus format</button>
        <span class="wi-ed-sep"></span>
        <button type="button" data-cmd="justifyLeft" title="Rata kiri" aria-pressed="false">Kiri</button>
        <button type="button" data-cmd="justifyCenter" title="Rata tengah" aria-pressed="false">Tengah</button>
        <button type="button" data-cmd="justifyRight" title="Rata kanan" aria-pressed="false">Kanan</button>
        <button type="button" data-cmd="justifyFull" title="Rata kiri-kanan" aria-pressed="false">Rata</button>
        <span class="wi-ed-sep"></span>
        <select data-wied="leading" aria-label="Spasi baris" title="Spasi baris">
          <option value="" selected>Spasi baris</option>
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
        <select data-wied="spaceBefore" aria-label="Spasi sebelum paragraf" title="Spasi sebelum paragraf">
          <option value="" selected>Sebelum</option>
          <option value="0">0 pt</option>
          <option value="6">6 pt</option>
          <option value="12">12 pt</option>
        </select>
        <select data-wied="spaceAfter" aria-label="Spasi sesudah paragraf" title="Spasi sesudah paragraf">
          <option value="" selected>Sesudah</option>
          <option value="0">0 pt</option>
          <option value="6">6 pt</option>
          <option value="12">12 pt</option>
        </select>
        <button type="button" data-cmd="indentOut" title="Kurangi indentasi">Geser kiri</button>
        <button type="button" data-cmd="indentIn" title="Tambah indentasi">Geser kanan</button>
        <button type="button" data-cmd="hanging" title="Indentasi gantung (baris pertama menjorok keluar)" aria-pressed="false">Indentasi gantung</button>
        <span class="wi-ed-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Daftar berpoin" aria-pressed="false">Poin</button>
        <button type="button" data-cmd="insertOrderedList" title="Daftar bernomor" aria-pressed="false">Nomor</button>
        <span class="wi-ed-sep"></span>
        <button type="button" data-wied-open="find" title="Cari dan ganti teks">Cari</button>
        <button type="button" data-wied-open="link" title="Sisipkan tautan">Tautan</button>
      </div>
      <div class="wi-ed-util" data-wied-util hidden>
        <div class="wi-ed-util-row" data-wied-panel="find" hidden>
          <label class="wi-ed-util-f">Cari <input type="text" data-wied-find autocomplete="off" placeholder="Kata yang dicari"></label>
          <label class="wi-ed-util-f">Ganti dengan <input type="text" data-wied-repl autocomplete="off" placeholder="Teks pengganti"></label>
          <button type="button" data-wied-act="prev">Sebelumnya</button>
          <button type="button" data-wied-act="next">Berikutnya</button>
          <button type="button" data-wied-act="one">Ganti</button>
          <button type="button" data-wied-act="all">Ganti Semua</button>
          <label class="wi-ed-util-c"><input type="checkbox" data-wied-case> Samakan huruf besar/kecil</label>
          <span class="wi-ed-util-count" data-wied-count role="status"></span>
          <button type="button" data-wied-act="close" aria-label="Tutup panel">×</button>
          <p class="wi-ed-util-note">Mengganti teks menggambar ulang isi editor tanpa format visual (tebal, warna, spasi). Teksnya sendiri tidak berubah selain pada bagian yang diganti.</p>
        </div>
        <div class="wi-ed-util-row" data-wied-panel="link" hidden>
          <label class="wi-ed-util-f">Alamat tautan <input type="text" data-wied-url autocomplete="off" placeholder="https://contoh.com"></label>
          <label class="wi-ed-util-f">Teks tautan <input type="text" data-wied-ltext autocomplete="off" placeholder="Teks yang ditampilkan"></label>
          <button type="button" data-wied-act="insert">Sisipkan</button>
          <button type="button" data-wied-act="close" aria-label="Tutup panel">×</button>
          <span class="wi-ed-util-count" data-wied-lmsg role="alert"></span>
          <p class="wi-ed-util-note">Tautan hanya tampil selama menyunting di editor. Teks yang dianalisis dan diekspor adalah teksnya saja, tanpa alamat tautan.</p>
        </div>
        <p class="wi-ed-hint" data-wied-hint hidden>Pilih dulu teksnya untuk mengubah ukuran huruf di kotak ini.</p>
      </div>
      <div class="wi-ed-surface" id="wi-ed-surface" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Teks yang ingin dirapikan" data-placeholder="Tempel atau ketik teks di sini…"></div>`;
      var wrap = null, ed = null, bar = null;
      var mode = "editor";
      var syncing = false;
      var savedRange = null;
      var nativeGet = null, nativeSet = null;
      function edFail(){
        try { if(wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch(e) {}
        try { ta.classList.remove("wi-ed-off"); } catch(e) {}
        if(window.console && console.warn) console.warn("Saksara: editor kaya gagal dimulai; kotak teks polos tetap dipakai.");
      }
      try {
        wrap = document.createElement("div");
        wrap.className = "wi-ed-wrap";
        wrap.innerHTML = ED_HTML;
        ta.parentNode.insertBefore(wrap, ta);
        ed = wrap.querySelector(".wi-ed-surface");
        bar = wrap.querySelector(".wi-ed-bar");
        if(!ed || !bar) throw new Error("wi-ed-dom");
        /* Kait nilai tulang punggung: penulisan programatis apa pun ke
           #wi-input.value (impor, reset, alur cepat) digambar ulang ke
           editor; penulisan dari editor sendiri ditandai syncing agar
           tidak menggambar ulang di tengah mengetik. */
        var proto = window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype;
        var desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        if(!desc || !desc.get || !desc.set) throw new Error("wi-ed-desc");
        nativeGet = desc.get; nativeSet = desc.set;
        Object.defineProperty(ta, "value", {
          configurable: true, enumerable: true,
          get: function(){ return nativeGet.call(ta); },
          set: function(v){
            nativeSet.call(ta, v);
            if(!syncing && mode === "editor"){ try { renderFromBackbone(); } catch(e) {} }
          }
        });
        /* Fokus programatis ke textarea (alur lama: Bersihkan, Analisis
           pada teks kosong, Lihat lokasi) dialihkan ke editor. */
        var nativeFocus = ta.focus;
        ta.focus = function(){
          if(mode === "editor"){ try { ed.focus(); return; } catch(e) {} }
          return nativeFocus.apply(ta, arguments);
        };
      } catch(e) { edFail(); return; }

      function updateEmpty(){
        wrap.classList.toggle("wi-ed-empty", wiEdSerialize(ed) === "");
      }
      function renderFromBackbone(){
        var text = nativeGet.call(ta);
        ed.innerHTML = "";
        wiEdSplitBlocks(text).forEach(function(lines){
          var p = document.createElement("p");
          lines.forEach(function(line, i){
            if(i > 0) p.appendChild(document.createElement("br"));
            /* Unit kosong tunggal dirender sebagai <p><br></p>:
               paragraf tanpa anak membuat Firefox membuang ketikan ke
               luar paragraf (terukur di QA Tahap 4 — <p></p> dan <p>
               berisi simpul teks kosong sama-sama lolos ke akar),
               sedangkan <br> bantalan memberi paragraf tinggi baris
               dan ketikan masuk ke dalamnya dari posisi klik mana pun;
               serialisasi ED-CORE membuang br bantalan itu kembali
               menjadi unit kosong. */
            if(line === "" && lines.length === 1){
              p.appendChild(document.createElement("br"));
              return;
            }
            p.appendChild(document.createTextNode(line));
          });
          ed.appendChild(p);
        });
        updateEmpty();
      }
      function syncFromEditor(){
        var text = wiEdSerialize(ed);
        if(text !== nativeGet.call(ta)){
          syncing = true;
          try { nativeSet.call(ta, text); } finally { syncing = false; }
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
        updateEmpty();
      }
      function saveRange(){
        var sel = window.getSelection();
        if(sel && sel.rangeCount){
          var r = sel.getRangeAt(0);
          if(ed.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
        }
      }
      function restoreRange(){
        ed.focus();
        if(!savedRange) return;
        try {
          var sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(savedRange);
        } catch(e) {}
      }
      function cmd(name, val){
        restoreRange();
        try { document.execCommand(name, false, val == null ? null : val); } catch(e) {}
        syncFromEditor(); saveRange();
      }
      function cmdCss(name, val){
        restoreRange();
        try {
          document.execCommand("styleWithCSS", false, true);
          document.execCommand(name, false, val);
          document.execCommand("styleWithCSS", false, false);
        } catch(e) {}
        syncFromEditor(); saveRange();
      }
      /* Ukuran huruf memakai span bergaya sendiri: execCommand
         fontSize Firefox hanya mengenal skala lama 1–7, bukan pt. */
      function applyFontSize(pt){
        restoreRange();
        var sel = window.getSelection();
        if(!sel || !sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        var span = document.createElement("span");
        span.style.fontSize = pt + "pt";
        try {
          if(range.collapsed){
            span.appendChild(document.createTextNode("\u200B"));
            range.insertNode(span);
            var r2 = document.createRange();
            r2.setStart(span.firstChild, 1); r2.collapse(true);
            sel.removeAllRanges(); sel.addRange(r2);
          } else {
            span.appendChild(range.extractContents());
            range.insertNode(span);
            var r3 = document.createRange();
            r3.selectNodeContents(span);
            sel.removeAllRanges(); sel.addRange(r3);
          }
        } catch(e) { return; }
        syncFromEditor(); saveRange();
      }
      function leafBlocks(){
        var out = [];
        var sel = window.getSelection();
        if(!sel || !sel.rangeCount) return out;
        var range = sel.getRangeAt(0);
        var all = ed.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th");
        for(var i=0;i<all.length;i++){
          var b = all[i];
          var hit = false;
          try { hit = range.intersectsNode(b); } catch(e) { hit = false; }
          if(!hit) continue;
          if(b.querySelector("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th")) continue;
          out.push(b);
        }
        return out;
      }
      function blockStyle(fn){
        restoreRange();
        leafBlocks().forEach(fn);
        syncFromEditor(); saveRange();
      }
      function edIndent(delta){
        blockStyle(function(b){
          var ml = Math.max(0, wiEdPxLen(b.style.marginLeft) + delta);
          b.style.marginLeft = ml ? ml + "px" : "";
          if(ml === 0 && b.getAttribute("data-wied-hang")){
            b.removeAttribute("data-wied-hang");
            b.style.textIndent = "";
          }
        });
      }
      function edHangToggle(){
        blockStyle(function(b){
          var ml = wiEdPxLen(b.style.marginLeft);
          if(b.getAttribute("data-wied-hang")){
            b.removeAttribute("data-wied-hang");
            b.style.textIndent = "";
            ml = Math.max(0, ml - 24);
            b.style.marginLeft = ml ? ml + "px" : "";
          } else {
            b.setAttribute("data-wied-hang", "1");
            b.style.marginLeft = (ml + 24) + "px";
            b.style.textIndent = "-24px";
          }
        });
      }
      function edRemoveFormat(){
        var blocks = leafBlocks();
        cmd("removeFormat");
        blocks.forEach(function(b){
          b.style.lineHeight = ""; b.style.marginTop = ""; b.style.marginBottom = "";
          b.style.marginLeft = ""; b.style.textIndent = ""; b.style.textAlign = "";
          b.removeAttribute("data-wied-hang");
        });
        syncFromEditor();
      }
      /* ---------- Pembersih tempelan (daftar putih) ---------- */
      var ED_OK_TAGS = { P:1, DIV:1, BR:1, B:1, STRONG:1, I:1, EM:1, U:1, S:1, STRIKE:1, SUB:1, SUP:1, SPAN:1, UL:1, OL:1, LI:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1, PRE:1, A:1 };
      var ED_DROP_TAGS = { SCRIPT:1, STYLE:1, IFRAME:1, OBJECT:1, EMBED:1, LINK:1, META:1, TITLE:1, IMG:1, VIDEO:1, AUDIO:1, SOURCE:1, TRACK:1, CANVAS:1, SVG:1, MATH:1, FORM:1, INPUT:1, BUTTON:1, TEXTAREA:1, SELECT:1, OPTION:1, HEAD:1, HR:1, AREA:1, BASE:1, PARAM:1 };
      function edUnwrap(el){
        var parent = el.parentNode;
        if(!parent) return;
        while(el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      function edCleanChildren(node){
        Array.prototype.slice.call(node.childNodes).forEach(function(k){
          if(k.nodeType === 8){ node.removeChild(k); return; }
          if(k.nodeType !== 1) return;
          var tag = k.tagName;
          if(ED_DROP_TAGS[tag]){ node.removeChild(k); return; }
          var styleAttr = k.getAttribute("style") || "";
          var hrefAttr = k.getAttribute("href") || "";
          var faceAttr = k.getAttribute("face") || "";
          edCleanChildren(k);
          if(tag === "FONT"){
            var sp = document.createElement("span");
            var st = wiEdFilterStyle(styleAttr, "inline");
            if(faceAttr && /^[A-Za-z0-9 ,\-']+$/.test(faceAttr))
              st = (st ? st + "; " : "") + "font-family: " + faceAttr;
            if(st) sp.setAttribute("style", st);
            while(k.firstChild) sp.appendChild(k.firstChild);
            k.parentNode.replaceChild(sp, k);
            return;
          }
          if(!ED_OK_TAGS[tag]){ edUnwrap(k); return; }
          var keep = "";
          if(tag === "SPAN") keep = wiEdFilterStyle(styleAttr, "inline");
          else if(WI_ED_BLOCK_TAGS[tag]) keep = wiEdFilterStyle(styleAttr, "block");
          while(k.attributes && k.attributes.length) k.removeAttribute(k.attributes[0].name);
          if(keep) k.setAttribute("style", keep);
          if(tag === "A"){
            if(/^(https?:|mailto:)/i.test(hrefAttr)){
              k.setAttribute("href", hrefAttr);
              k.setAttribute("rel", "noopener");
            } else edUnwrap(k);
          }
        });
      }
      function edCleanFragment(holder){
        Array.prototype.slice.call(holder.querySelectorAll("table")).forEach(function(tbl){
          Array.prototype.slice.call(tbl.querySelectorAll("td,th")).forEach(function(cell){
            var p = document.createElement("p");
            while(cell.firstChild) p.appendChild(cell.firstChild);
            if(cell.parentNode) cell.parentNode.replaceChild(p, cell);
          });
          edUnwrap(tbl);
        });
        edCleanChildren(holder);
      }
      ed.addEventListener("paste", function(e){
        e.preventDefault();
        var cd = e.clipboardData || window.clipboardData;
        var html = "", text = "";
        try {
          if(cd){ html = cd.getData("text/html") || ""; text = cd.getData("text/plain") || ""; }
        } catch(err) {}
        ed.focus();
        if(html){
          try {
            var holder = document.createElement("div");
            holder.innerHTML = html;
            edCleanFragment(holder);
            var clean = holder.innerHTML;
            if(clean) document.execCommand("insertHTML", false, clean);
            else if(text) document.execCommand("insertText", false, text);
          } catch(err) {
            if(text) document.execCommand("insertText", false, text);
          }
        } else if(text){
          try { document.execCommand("insertText", false, text); } catch(err) {}
        }
        syncFromEditor(); saveRange();
      });
      ed.addEventListener("input", function(){ syncFromEditor(); });
      document.addEventListener("selectionchange", function(){
        var sel = window.getSelection();
        if(sel && sel.rangeCount && ed.contains(sel.getRangeAt(0).commonAncestorContainer)){ saveRange(); queueReflect(); }
      });
      /* Bilah alat: mousedown tombol tidak boleh mencuri seleksi editor;
         seleksi selalu disnapshot agar perintah berlaku pada teks yang
         dipilih pengguna, termasuk sesudah fokus berpindah ke select. */
      bar.addEventListener("mousedown", function(e){
        saveRange();
        var t = e.target;
        if(t && t.closest && t.closest("button")) e.preventDefault();
      });
      bar.addEventListener("click", function(e){
        var t = e.target;
        var b = (t && t.closest) ? t.closest("button[data-cmd]") : null;
        if(!b) return;
        var c = b.getAttribute("data-cmd");
        if(c === "indentIn") edIndent(24);
        else if(c === "indentOut") edIndent(-24);
        else if(c === "hanging") edHangToggle();
        else if(c === "removeFormat") edRemoveFormat();
        else if(c.indexOf("justify") === 0){
          /* Firefox (styleWithCSS mati) menulis perataan sebagai
             atribut align=; normalkan ke style text-align agar
             seragam dengan perintah blok lain dan dipertahankan
             penyaring tempel (text-align ada di daftar putih blok). */
          var blocks = leafBlocks();
          cmd(c);
          blocks.forEach(function(bl){
            var al = bl.getAttribute("align");
            if(al){ bl.style.textAlign = al; bl.removeAttribute("align"); }
          });
          syncFromEditor();
        }
        else cmd(c);
      });
      bar.addEventListener("change", function(e){
        var t = e.target;
        if(!t || !t.getAttribute) return;
        var k = t.getAttribute("data-wied");
        var v = t.value;
        if(!k || !v) return;
        if(k === "style"){ cmd("formatBlock", v); t.value = ""; }
        else if(k === "font"){ cmdCss("fontName", v); }
        else if(k === "size"){ applyFontSize(v); }
        else if(k === "leading"){ blockStyle(function(b){ b.style.lineHeight = v; }); t.value = ""; }
        else if(k === "spaceBefore"){ blockStyle(function(b){ b.style.marginTop = v + "pt"; }); t.value = ""; }
        else if(k === "spaceAfter"){ blockStyle(function(b){ b.style.marginBottom = v + "pt"; }); t.value = ""; }
        else if(k === "fore"){ cmdCss("foreColor", v); }
        else if(k === "hilite"){ cmdCss("hiliteColor", v); }
      });
      /* ---------- Paket Toolbar: Cari & Ganti (G1), Tautan (G2), Refleksi (G3) ----------
         Cari & Ganti bekerja di tingkat tulang punggung (keputusan D-2):
         pencarian/penggantian berjalan pada string #wi-input sendiri,
         ditulis kembali lewat setter bawaan (kait nilai menggambar ulang
         editor) dan peristiwa "input" dipancarkan persis seperti ketikan
         biasa — gerbang kejujuran warisan (penghitung, penolakan "Lihat
         lokasi" saat teks berubah, validasi ulang saran saat klik)
         menerima sinyal yang sama seperti suntingan manual. Navigasi
         hanya menyeleksi: offset tulang punggung dipetakan ke titik DOM
         oleh pola slot yang sama dengan jembatan D5 (edStreamSlots) dan
         digulir di dalam kotak editor saja, bukan halaman. */
      var util = wrap.querySelector("[data-wied-util]");
      var findPanel = wrap.querySelector('[data-wied-panel="find"]');
      var linkPanel = wrap.querySelector('[data-wied-panel="link"]');
      var findIn = wrap.querySelector("[data-wied-find]");
      var replIn = wrap.querySelector("[data-wied-repl]");
      var caseBox = wrap.querySelector("[data-wied-case]");
      var countEl = wrap.querySelector("[data-wied-count]");
      var urlIn = wrap.querySelector("[data-wied-url]");
      var ltextIn = wrap.querySelector("[data-wied-ltext]");
      var lmsgEl = wrap.querySelector("[data-wied-lmsg]");
      var hintEl = wrap.querySelector("[data-wied-hint]");
      var panelOpen = "";
      var hintOn = false;
      var findState = { offsets: [], idx: -1 };
      function syncUtilVis(){
        if(!util) return;
        util.hidden = !(mode === "editor" && (panelOpen !== "" || hintOn));
        if(findPanel) findPanel.hidden = panelOpen !== "find";
        if(linkPanel) linkPanel.hidden = panelOpen !== "link";
        if(hintEl) hintEl.hidden = !hintOn;
      }
      function showHint(){ hintOn = true; syncUtilVis(); }
      function hideHint(){ if(hintOn){ hintOn = false; syncUtilVis(); } }
      function needleNow(){ return ((findIn && findIn.value) || "").replace(/[\r\n]/g, ""); }
      function replNow(){ return ((replIn && replIn.value) || "").replace(/[\r\n]/g, ""); }
      function findRefresh(){
        var n = needleNow();
        findState.offsets = n ? wiEdFindOffsets(nativeGet.call(ta), n, !!(caseBox && caseBox.checked)) : [];
        if(findState.idx >= findState.offsets.length) findState.idx = findState.offsets.length - 1;
        var total = findState.offsets.length;
        if(countEl){
          countEl.textContent = !n ? "" :
            (total === 0 ? "Tidak ditemukan" :
              (findState.idx >= 0 ? (findState.idx + 1) + " dari " + total : total + " ditemukan"));
        }
        if(util){
          Array.prototype.forEach.call(util.querySelectorAll("[data-wied-act]"), function(b){
            var a = b.getAttribute("data-wied-act");
            if(a === "next" || a === "prev" || a === "one" || a === "all") b.disabled = (!n || total === 0);
          });
        }
      }
      function writeBackbone(next){
        ta.value = next;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      function edScrollToRange(range){
        try {
          var r = range.getBoundingClientRect();
          var er = ed.getBoundingClientRect();
          if(!r.height && !r.width) return;
          ed.scrollTop += (r.top - er.top) - (ed.clientHeight / 2) + (r.height / 2);
        } catch(e) {}
      }
      function selectBackboneRange(start, end){
        var slots = edStreamSlots();
        var a = slots[start], b = slots[end];
        if(!a || !b) return false;
        var range = document.createRange();
        try { range.setStart(a.node, a.off); range.setEnd(b.node, b.off); } catch(e) { return false; }
        var sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        edScrollToRange(range);
        saveRange();
        return true;
      }
      function findGo(dir){
        findRefresh();
        var total = findState.offsets.length;
        if(!total) return;
        var i = findState.idx;
        i = i < 0 ? (dir > 0 ? 0 : total - 1) : (i + dir + total) % total;
        findState.idx = i;
        var o = findState.offsets[i];
        if(mode === "editor") selectBackboneRange(o[0], o[1]);
        findRefresh();
      }
      function findReplaceOne(){
        findRefresh();
        var offs = findState.offsets;
        if(!offs.length) return;
        var i = findState.idx >= 0 ? findState.idx : 0;
        var o = offs[i];
        var text = nativeGet.call(ta);
        writeBackbone(text.slice(0, o[0]) + replNow() + text.slice(o[1]));
        findState.idx = i;
        findRefresh();
        var no = findState.offsets;
        if(no.length){
          var j = Math.min(i, no.length - 1);
          findState.idx = j;
          if(mode === "editor") selectBackboneRange(no[j][0], no[j][1]);
          findRefresh();
        } else savedRange = null;
      }
      function findReplaceAll(){
        var n = needleNow();
        if(!n) return;
        var res = wiEdReplaceAll(nativeGet.call(ta), n, replNow(), !!(caseBox && caseBox.checked));
        if(res.count) writeBackbone(res.text);
        findState.idx = -1;
        findRefresh();
        if(countEl) countEl.textContent = res.count ? ("Diganti di " + res.count + " tempat.") : "Tidak ditemukan";
      }
      var findTimer = null;
      if(findIn) findIn.addEventListener("input", function(){
        if(findTimer) clearTimeout(findTimer);
        findTimer = setTimeout(function(){ findState.idx = -1; findRefresh(); }, 200);
      });
      if(findIn) findIn.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); findGo(1); }
      });
      if(caseBox) caseBox.addEventListener("change", function(){ findState.idx = -1; findRefresh(); });
      function prepLinkPanel(){
        if(lmsgEl) lmsgEl.textContent = "";
        var txt = "";
        try { if(savedRange && !savedRange.collapsed) txt = savedRange.toString(); } catch(e) {}
        if(ltextIn) ltextIn.value = txt;
      }
      function linkInsert(){
        var url = ((urlIn && urlIn.value) || "").trim();
        if(!wiEdLinkSchemeOk(url)){
          if(lmsgEl) lmsgEl.textContent = "Alamat harus diawali https://, http://, atau mailto:";
          return;
        }
        if(lmsgEl) lmsgEl.textContent = "";
        restoreRange();
        var sel = window.getSelection();
        if(!sel || !sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        if(!ed.contains(range.commonAncestorContainer)) return;
        var a = document.createElement("a");
        a.setAttribute("href", url);
        a.setAttribute("rel", "noopener");
        var label = ((ltextIn && ltextIn.value) || "").trim();
        try {
          if(range.collapsed){
            a.appendChild(document.createTextNode(label || url));
            range.insertNode(a);
          } else if(label && range.toString() !== label){
            range.deleteContents();
            a.appendChild(document.createTextNode(label));
            range.insertNode(a);
          } else {
            a.appendChild(range.extractContents());
            range.insertNode(a);
          }
          var r2 = document.createRange();
          r2.setStartAfter(a); r2.collapse(true);
          sel.removeAllRanges(); sel.addRange(r2);
        } catch(e) { return; }
        panelOpen = ""; syncUtilVis();
        syncFromEditor(); saveRange();
      }
      function openPanel(which){
        if(which === "link") prepLinkPanel();
        panelOpen = (panelOpen === which) ? "" : which;
        syncUtilVis();
        if(panelOpen === "find"){ findRefresh(); if(findIn) try { findIn.focus(); } catch(e) {} }
        if(panelOpen === "link" && urlIn) try { urlIn.focus(); } catch(e) {}
      }
      bar.addEventListener("click", function(e){
        var t = e.target;
        var b = (t && t.closest) ? t.closest("button[data-wied-open]") : null;
        if(b) openPanel(b.getAttribute("data-wied-open"));
      });
      if(util) util.addEventListener("click", function(e){
        var t = e.target;
        var b = (t && t.closest) ? t.closest("button[data-wied-act]") : null;
        if(!b || b.disabled) return;
        var a = b.getAttribute("data-wied-act");
        if(a === "close"){ panelOpen = ""; syncUtilVis(); }
        else if(a === "next") findGo(1);
        else if(a === "prev") findGo(-1);
        else if(a === "one") findReplaceOne();
        else if(a === "all") findReplaceAll();
        else if(a === "insert") linkInsert();
      });
      if(util) util.addEventListener("keydown", function(e){
        if(e.key === "Escape"){ panelOpen = ""; syncUtilVis(); }
      });
      /* ---------- G3: refleksi keadaan tombol ----------
         Baca-murni: hanya membaca seleksi + DOM editor, hanya menulis
         ke bilah alat (kelas is-on, aria-pressed, nilai pilihan).
         Tidak menyentuh anak editor, seleksi, maupun tulang punggung,
         sehingga pemetaan offset D5 tidak terpengaruh sama sekali.
         Dijadwalkan lewat requestAnimationFrame dari pendengar
         selectionchange yang sudah ada dan sesudah perintah bilah
         alat. Kegagalan refleksi tidak boleh mengganggu penyuntingan:
         seluruhnya dibungkus try/catch. */
      var reflectQueued = false;
      function queueReflect(){
        if(reflectQueued) return;
        reflectQueued = true;
        if(window.requestAnimationFrame) window.requestAnimationFrame(function(){ edReflect(); });
        else edReflect();
      }
      function edReflect(){
        reflectQueued = false;
        try {
          var sel = window.getSelection();
          if(!sel || !sel.rangeCount) return;
          var range = sel.getRangeAt(0);
          if(!ed.contains(range.startContainer)) return;
          var anchor = range.startContainer;
          var el = anchor.nodeType === 1 ? anchor : anchor.parentNode;
          var on = { bold: false, italic: false, underline: false, strikeThrough: false, subscript: false, superscript: false };
          var n = el;
          while(n && n !== ed){
            var tg = n.tagName;
            if(tg === "B" || tg === "STRONG") on.bold = true;
            else if(tg === "I" || tg === "EM") on.italic = true;
            else if(tg === "U") on.underline = true;
            else if(tg === "S" || tg === "STRIKE") on.strikeThrough = true;
            else if(tg === "SUB") on.subscript = true;
            else if(tg === "SUP") on.superscript = true;
            n = n.parentNode;
          }
          if(el){
            var cs = window.getComputedStyle(el);
            if(cs.fontWeight === "bold" || parseInt(cs.fontWeight, 10) >= 600) on.bold = true;
            if(cs.fontStyle === "italic" || cs.fontStyle === "oblique") on.italic = true;
            var td = cs.textDecorationLine || cs.textDecoration || "";
            if(td.indexOf("underline") >= 0) on.underline = true;
            if(td.indexOf("line-through") >= 0) on.strikeThrough = true;
            if(cs.verticalAlign === "sub") on.subscript = true;
            if(cs.verticalAlign === "super") on.superscript = true;
            /* D-5: warna teks direfleksikan hanya bila terbaca sebagai
               satu nilai rgb() tunggal; warna sorotan tidak pernah. */
            var m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(cs.color || "");
            if(m){
              var hex = "#" + [m[1], m[2], m[3]].map(function(x){ var h = Number(x).toString(16); return h.length < 2 ? "0" + h : h; }).join("");
              var fore = bar.querySelector('[data-wied="fore"]');
              if(fore) fore.value = hex;
            }
            var fontSel = bar.querySelector('[data-wied="font"]');
            if(fontSel){
              var fam = (cs.fontFamily || "").split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
              var hit = "";
              Array.prototype.forEach.call(fontSel.options, function(o){
                if(!o.value) return;
                if(o.value.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase() === fam) hit = o.value;
              });
              fontSel.value = hit;
            }
            var sizeSel = bar.querySelector('[data-wied="size"]');
            if(sizeSel){
              var pt = parseFloat(cs.fontSize) * 72 / 96;
              var hitS = "";
              Array.prototype.forEach.call(sizeSel.options, function(o){
                if(o.value && Math.abs(parseFloat(o.value) - pt) < 0.01) hitS = o.value;
              });
              sizeSel.value = hitS;
            }
          }
          var blocks = leafBlocks();
          var blk = blocks.length ? blocks[0] : null;
          var align = "", listCmd = "", hang = false;
          if(blk){
            align = window.getComputedStyle(blk).textAlign || "";
            var p = blk;
            while(p && p !== ed){
              if(p.tagName === "UL"){ listCmd = "insertUnorderedList"; break; }
              if(p.tagName === "OL"){ listCmd = "insertOrderedList"; break; }
              p = p.parentNode;
            }
            hang = !!blk.getAttribute("data-wied-hang");
            var styleSel = bar.querySelector('[data-wied="style"]');
            if(styleSel){
              var map = { P: "P", H1: "H1", H2: "H2", H3: "H3", BLOCKQUOTE: "BLOCKQUOTE" };
              styleSel.value = map[blk.tagName] || "";
            }
          }
          var want = {
            bold: on.bold, italic: on.italic, underline: on.underline,
            strikeThrough: on.strikeThrough, subscript: on.subscript, superscript: on.superscript,
            justifyLeft: align === "left" || align === "start",
            justifyCenter: align === "center",
            justifyRight: align === "right" || align === "end",
            justifyFull: align === "justify",
            insertUnorderedList: listCmd === "insertUnorderedList",
            insertOrderedList: listCmd === "insertOrderedList",
            hanging: hang
          };
          Object.keys(want).forEach(function(c){
            var b = bar.querySelector('button[data-cmd="' + c + '"]');
            if(!b) return;
            b.classList.toggle("is-on", !!want[c]);
            b.setAttribute("aria-pressed", want[c] ? "true" : "false");
          });
        } catch(e) {}
      }
      bar.addEventListener("click", function(){ queueReflect(); });
      bar.addEventListener("change", function(){ queueReflect(); });
      /* ---------- "Lihat lokasi" (D5) di mode editor ----------
         Penangan lama tetap berjalan (gerbang kejujuran + catatan +
         kedip kartu); penangan ini menambahkan seleksi yang terlihat
         di permukaan editor. Pemetaan offset global -> titik DOM
         meniru persis serialisasi ED-CORE (unit, pemisah "\n\n",
         br bantalan tidak dihitung, U+200B tidak dihitung). */
      function edUnitNodes(){
        var units = [];
        var strayNodes = null;
        function flushStray(){
          if(strayNodes){
            var lines = wiEdWalkInline(strayNodes, [""]);
            if(/\S/.test(lines.join("\n"))) units.push({ nodes: strayNodes, phantomBr: null });
            strayNodes = null;
          }
        }
        function collect(node){
          var kids = node.childNodes || [];
          for(var i=0;i<kids.length;i++){
            var k = kids[i];
            if(wiEdIsBlock(k)){
              flushStray();
              if(WI_ED_CONTAINER_TAGS[k.tagName] && !WI_ED_BLOCK_TAGS[k.tagName]){ collect(k); continue; }
              var sub = k.childNodes || [];
              var hasBlock = false;
              for(var j=0;j<sub.length;j++){ if(wiEdIsBlock(sub[j])){ hasBlock = true; break; } }
              if(hasBlock){ collect(k); continue; }
              var last = sub[sub.length-1];
              units.push({ nodes: [k], phantomBr: (last && last.nodeType === 1 && last.tagName === "BR") ? last : null });
            } else {
              if(!strayNodes) strayNodes = [];
              strayNodes.push(k);
            }
          }
        }
        collect(ed);
        flushStray();
        return units;
      }
      function edStreamSlots(){
        var units = edUnitNodes();
        var slots = [];
        var endPoint = null;
        function walkNode(n, phantom){
          if(n.nodeType === 3){
            var v = n.nodeValue || "";
            for(var j=0;j<v.length;j++){
              if(v.charAt(j) === "\u200B") continue;
              slots.push({ node: n, off: j });
            }
            if(v.length) endPoint = { node: n, off: v.length };
            return;
          }
          if(n.nodeType !== 1) return;
          if(n.tagName === "BR"){
            if(n === phantom) return;
            var parent = n.parentNode;
            if(!parent) return;
            var idx = Array.prototype.indexOf.call(parent.childNodes, n);
            slots.push({ node: parent, off: idx });
            endPoint = { node: parent, off: idx + 1 };
            return;
          }
          var kids = n.childNodes;
          for(var i=0;i<kids.length;i++) walkNode(kids[i], phantom);
        }
        units.forEach(function(u, ui){
          if(ui > 0 && endPoint) slots.push(endPoint, endPoint);
          u.nodes.forEach(function(n){ walkNode(n, u.phantomBr); });
          if(!endPoint && u.nodes.length) endPoint = { node: u.nodes[0], off: 0 };
        });
        slots.push(endPoint);
        return slots;
      }
      function edLocate(id){
        if(mode !== "editor") return;
        if(typeof wiResult === "undefined" || !wiResult) return;
        var s = null;
        wiResult.suggestions.forEach(function(x){ if(x.id === id) s = x; });
        if(!s) return;
        if(ta.value !== wiJoin(wiResult.paragraphs, wiResult.separators)) return;
        var base = 0;
        for(var i=0;i<s.pIdx;i++)
          base += wiResult.paragraphs[i].length + (wiResult.separators[i] ? wiResult.separators[i].length : 0);
        var slots = edStreamSlots();
        var a = slots[base + s.start], b = slots[base + s.end];
        if(!a || !b) return;
        var range = document.createRange();
        try { range.setStart(a.node, a.off); range.setEnd(b.node, b.off); } catch(e) { return; }
        var sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        var el = range.startContainer;
        if(el && el.nodeType !== 1) el = el.parentNode;
        while(el && el !== ed && !(el.nodeType === 1 && WI_ED_BLOCK_TAGS[el.tagName])) el = el.parentNode;
        if(el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
        saveRange(); queueReflect();
      }
      var reportEl = $("wi-report");
      if(reportEl){
        reportEl.addEventListener("click", function(e){
          var t = e.target;
          var b = (t && t.closest) ? t.closest("[data-wi-locate]") : null;
          if(b) edLocate(b.getAttribute("data-wi-locate"));
        });
      }
      /* ---------- Mode Editor | Teks polos ---------- */
      var modeBtns = Array.prototype.slice.call(wrap.querySelectorAll("[data-wied-mode]"));
      function setMode(m){
        if(m === mode) return;
        if(m === "plain") syncFromEditor();
        mode = m;
        var edOn = m === "editor";
        bar.hidden = !edOn;
        ed.hidden = !edOn;
        syncUtilVis();
        ta.classList.toggle("wi-ed-off", edOn);
        modeBtns.forEach(function(b){
          var on = b.getAttribute("data-wied-mode") === m;
          b.classList.toggle("is-on", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if(edOn){ renderFromBackbone(); ed.focus(); }
        else ta.focus();
      }
      modeBtns.forEach(function(b){
        b.addEventListener("click", function(){ setMode(b.getAttribute("data-wied-mode")); });
      });
      /* ---------- Mulai ---------- */
      try { document.execCommand("styleWithCSS", false, false); } catch(e) {}
      renderFromBackbone();
      ta.classList.add("wi-ed-off");
    })();
    /* ================= Editor Kaya Semua Permukaan (D8 Tahap 5) =================
       Pabrik editor yang digeneralisasi dari lem Asisten Menulis
       (Tahap 4): permukaan tulis contenteditable bergaya pengolah kata
       di atas tulang punggung teks polos, kini dipasang pada SETIAP
       permukaan masukan teks lain — Periksa Tulisan (#input-teks),
       Kenali Gaya Tulisan (#wf-input), Bandingkan Tulisan (#cmp-a dan
       #cmp-b), periksa cepat beranda (#p7-quick-text), dan hasil OCR
       (#ocr-out). Setiap textarea tulang punggung TETAP satu-satunya
       sumber kebenaran di DOM: seluruh alur lama permukaan itu
       (penghitung, unggah berkas, contoh uji, bersihkan, tukar,
       serah-terima OCR, riwayat, analisis) membaca/menulis .value
       persis seperti sebelumnya — tidak ada satu baris alur lama yang
       diubah. Editor hanya permukaan: suntingannya diserialkan ke
       teks polos oleh ED-CORE dan ditulis ke tulang punggung lewat
       setter bawaan + peristiwa "input" (sinyal yang sama dengan
       ketikan polos); sebaliknya penulisan programatis apa pun ke
       .value ditangkap kait setter nilai instans dan digambar ulang
       ke editor; fokus programatis dialihkan ke editor di mode
       Editor. Mode "Teks polos" menyembunyikan editor dan menampilkan
       textarea apa adanya: perilaku persis seperti sebelum tahap ini.
       Varian serialisasi: semua permukaan ini memakai varian LITERAL
       (wiEdSerializeLiteral) — jalur polos mereka tidak menormalkan
       U+00A0/U+200B, dan pembuangan U+200B terbukti mengubah hasil
       analisis (menggabungkan dua kata menjadi satu), sehingga hanya
       varian literal yang lulus gerbang ekuivalensi identik JSON
       penuh (editor-multi-test.cjs). Asisten Menulis TIDAK memakai
       pabrik ini: instans Tahap 4-nya dibiarkan byte-identik agar
       perilakunya persis seperti sebelumnya. Bila inisialisasi satu
       permukaan gagal di tengah, tambahan permukaan itu dilepas dan
       kotak teks lamanya tetap bekerja — kegagalan satu editor tidak
       dapat mematahkan halaman maupun permukaan lain. */
    (function(){
      if(!window.getSelection || !document.createRange) return;
      function edEscAttr(s){
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      }
      var ED_CONTROLS_HTML = `
      <div class="wi-ed-mode" role="group" aria-label="Mode kotak teks">
        <button type="button" class="wi-ed-mode-btn is-on" data-wied-mode="editor" aria-pressed="true">Editor</button>
        <button type="button" class="wi-ed-mode-btn" data-wied-mode="plain" aria-pressed="false">Teks polos</button>
      </div>
      <div class="wi-ed-bar" role="toolbar" aria-label="Bilah format teks">
        <button type="button" data-cmd="undo" title="Urungkan">↩</button>
        <button type="button" data-cmd="redo" title="Ulangi">↪</button>
        <span class="wi-ed-sep"></span>
        <select data-wied="style" aria-label="Gaya paragraf" title="Gaya paragraf">
          <option value="" selected>Gaya</option>
          <option value="P">Paragraf</option>
          <option value="H1">Judul 1</option>
          <option value="H2">Judul 2</option>
          <option value="H3">Judul 3</option>
          <option value="BLOCKQUOTE">Kutipan</option>
        </select>
        <select data-wied="font" aria-label="Jenis huruf" title="Jenis huruf">
          <option value="" selected>Huruf</option>
          <option value="'Plus Jakarta Sans', sans-serif">Bawaan (Plus Jakarta Sans)</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Calibri, sans-serif">Calibri</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
        <select data-wied="size" aria-label="Ukuran huruf" title="Ukuran huruf">
          <option value="" selected>Ukuran</option>
          <option value="10">10 pt</option>
          <option value="11">11 pt</option>
          <option value="12">12 pt</option>
          <option value="13">13 pt</option>
          <option value="14">14 pt</option>
          <option value="16">16 pt</option>
          <option value="18">18 pt</option>
          <option value="20">20 pt</option>
          <option value="22">22 pt</option>
          <option value="24">24 pt</option>
        </select>
        <span class="wi-ed-sep"></span>
        <button type="button" data-cmd="bold" title="Tebal" aria-pressed="false"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Miring" aria-pressed="false"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Garis bawah" aria-pressed="false"><u>U</u></button>
        <button type="button" data-cmd="strikeThrough" title="Coret" aria-pressed="false"><s>S</s></button>
        <button type="button" data-cmd="subscript" title="Subskrip (tulis kecil di bawah)" aria-pressed="false">x<sub>2</sub></button>
        <button type="button" data-cmd="superscript" title="Superskrip (tulis kecil di atas)" aria-pressed="false">x<sup>2</sup></button>
        <label class="wi-ed-color" title="Warna teks">A<input type="color" data-wied="fore" value="#14304f" aria-label="Warna teks"></label>
        <label class="wi-ed-color" title="Warna sorotan teks"><span class="wi-ed-hilite-mark">A</span><input type="color" data-wied="hilite" value="#fbeec3" aria-label="Warna sorotan teks"></label>
        <button type="button" data-cmd="removeFormat" title="Hapus format pada teks/blok terpilih">Hapus format</button>
        <span class="wi-ed-sep"></span>
        <button type="button" data-cmd="justifyLeft" title="Rata kiri" aria-pressed="false">Kiri</button>
        <button type="button" data-cmd="justifyCenter" title="Rata tengah" aria-pressed="false">Tengah</button>
        <button type="button" data-cmd="justifyRight" title="Rata kanan" aria-pressed="false">Kanan</button>
        <button type="button" data-cmd="justifyFull" title="Rata kiri-kanan" aria-pressed="false">Rata</button>
        <span class="wi-ed-sep"></span>
        <select data-wied="leading" aria-label="Spasi baris" title="Spasi baris">
          <option value="" selected>Spasi baris</option>
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
        <select data-wied="spaceBefore" aria-label="Spasi sebelum paragraf" title="Spasi sebelum paragraf">
          <option value="" selected>Sebelum</option>
          <option value="0">0 pt</option>
          <option value="6">6 pt</option>
          <option value="12">12 pt</option>
        </select>
        <select data-wied="spaceAfter" aria-label="Spasi sesudah paragraf" title="Spasi sesudah paragraf">
          <option value="" selected>Sesudah</option>
          <option value="0">0 pt</option>
          <option value="6">6 pt</option>
          <option value="12">12 pt</option>
        </select>
        <button type="button" data-cmd="indentOut" title="Kurangi indentasi">Geser kiri</button>
        <button type="button" data-cmd="indentIn" title="Tambah indentasi">Geser kanan</button>
        <button type="button" data-cmd="hanging" title="Indentasi gantung (baris pertama menjorok keluar)" aria-pressed="false">Indentasi gantung</button>
        <span class="wi-ed-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Daftar berpoin" aria-pressed="false">Poin</button>
        <button type="button" data-cmd="insertOrderedList" title="Daftar bernomor" aria-pressed="false">Nomor</button>
        <span class="wi-ed-sep"></span>
        <button type="button" data-wied-open="find" title="Cari dan ganti teks">Cari</button>
        <button type="button" data-wied-open="link" title="Sisipkan tautan">Tautan</button>
      </div>
      <div class="wi-ed-util" data-wied-util hidden>
        <div class="wi-ed-util-row" data-wied-panel="find" hidden>
          <label class="wi-ed-util-f">Cari <input type="text" data-wied-find autocomplete="off" placeholder="Kata yang dicari"></label>
          <label class="wi-ed-util-f">Ganti dengan <input type="text" data-wied-repl autocomplete="off" placeholder="Teks pengganti"></label>
          <button type="button" data-wied-act="prev">Sebelumnya</button>
          <button type="button" data-wied-act="next">Berikutnya</button>
          <button type="button" data-wied-act="one">Ganti</button>
          <button type="button" data-wied-act="all">Ganti Semua</button>
          <label class="wi-ed-util-c"><input type="checkbox" data-wied-case> Samakan huruf besar/kecil</label>
          <span class="wi-ed-util-count" data-wied-count role="status"></span>
          <button type="button" data-wied-act="close" aria-label="Tutup panel">×</button>
          <p class="wi-ed-util-note">Mengganti teks menggambar ulang isi editor tanpa format visual (tebal, warna, spasi). Teksnya sendiri tidak berubah selain pada bagian yang diganti.</p>
        </div>
        <div class="wi-ed-util-row" data-wied-panel="link" hidden>
          <label class="wi-ed-util-f">Alamat tautan <input type="text" data-wied-url autocomplete="off" placeholder="https://contoh.com"></label>
          <label class="wi-ed-util-f">Teks tautan <input type="text" data-wied-ltext autocomplete="off" placeholder="Teks yang ditampilkan"></label>
          <button type="button" data-wied-act="insert">Sisipkan</button>
          <button type="button" data-wied-act="close" aria-label="Tutup panel">×</button>
          <span class="wi-ed-util-count" data-wied-lmsg role="alert"></span>
          <p class="wi-ed-util-note">Tautan hanya tampil selama menyunting di editor. Teks yang dianalisis dan diekspor adalah teksnya saja, tanpa alamat tautan.</p>
        </div>
        <p class="wi-ed-hint" data-wied-hint hidden>Pilih dulu teksnya untuk mengubah ukuran huruf di kotak ini.</p>
      </div>
      `;
      function saksaraEdAttach(ta, opts){
        if(!ta || !ta.parentNode) return;
        var serialize = opts.serialize;
        var ED_HTML = ED_CONTROLS_HTML + `
      <div class="wi-ed-surface" id="` + edEscAttr(opts.surfaceId) + `" contenteditable="true" role="textbox" aria-multiline="true" aria-label="` + edEscAttr(opts.ariaLabel) + `" data-placeholder="` + edEscAttr(ta.getAttribute("placeholder") || "Tempel atau ketik teks di sini…") + `"></div>`;
        var wrap = null, ed = null, bar = null;
        var mode = "editor";
        var syncing = false;
        var savedRange = null;
        var nativeGet = null, nativeSet = null;
        function edFail(){
          try { if(wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch(e) {}
          try { ta.classList.remove("ed-backbone-off"); } catch(e) {}
          if(window.console && console.warn) console.warn("Saksara: editor kaya gagal dimulai pada satu kotak teks; kotak teks polos tetap dipakai.");
        }
        try {
          wrap = document.createElement("div");
          wrap.className = "wi-ed-wrap";
          wrap.innerHTML = ED_HTML;
          ta.parentNode.insertBefore(wrap, ta);
          ed = wrap.querySelector(".wi-ed-surface");
          bar = wrap.querySelector(".wi-ed-bar");
          if(!ed || !bar) throw new Error("ed-dom");
          /* Kait nilai tulang punggung: penulisan programatis apa pun
             ke .value (unggah, contoh, bersihkan, tukar, serah-terima)
             digambar ulang ke editor; penulisan dari editor sendiri
             ditandai syncing agar tidak menggambar ulang di tengah
             mengetik. */
          var proto = window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype;
          var desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
          if(!desc || !desc.get || !desc.set) throw new Error("ed-desc");
          nativeGet = desc.get; nativeSet = desc.set;
          Object.defineProperty(ta, "value", {
            configurable: true, enumerable: true,
            get: function(){ return nativeGet.call(ta); },
            set: function(v){
              nativeSet.call(ta, v);
              if(!syncing && mode === "editor"){ try { renderFromBackbone(); } catch(e) {} }
            }
          });
          /* Fokus programatis ke textarea (alur lama: Bersihkan,
             Analisis pada teks kosong, per-judul bandingkan) dialihkan
             ke editor. */
          var nativeFocus = ta.focus;
          ta.focus = function(){
            if(mode === "editor"){ try { ed.focus(); return; } catch(e) {} }
            return nativeFocus.apply(ta, arguments);
          };
        } catch(e) { edFail(); return; }

        function updateEmpty(){
          wrap.classList.toggle("wi-ed-empty", serialize(ed) === "");
        }
        function renderFromBackbone(){
          var text = nativeGet.call(ta);
          ed.innerHTML = "";
          wiEdSplitBlocks(text).forEach(function(lines){
            var p = document.createElement("p");
            lines.forEach(function(line, i){
              if(i > 0) p.appendChild(document.createElement("br"));
              /* Unit kosong tunggal dirender sebagai <p><br></p> —
                 alasan sama seperti Tahap 4: paragraf tanpa anak
                 membuat Firefox membuang ketikan ke luar paragraf,
                 sedangkan <br> bantalan memberi paragraf tinggi baris;
                 serialisasi ED-CORE membuang br bantalan itu kembali
                 menjadi unit kosong. */
              if(line === "" && lines.length === 1){
                p.appendChild(document.createElement("br"));
                return;
              }
              p.appendChild(document.createTextNode(line));
            });
            ed.appendChild(p);
          });
          updateEmpty();
        }
        function syncFromEditor(){
          var text = serialize(ed);
          if(text !== nativeGet.call(ta)){
            syncing = true;
            try { nativeSet.call(ta, text); } finally { syncing = false; }
            ta.dispatchEvent(new Event("input", { bubbles: true }));
          }
          updateEmpty();
        }
        function saveRange(){
          var sel = window.getSelection();
          if(sel && sel.rangeCount){
            var r = sel.getRangeAt(0);
            if(ed.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
          }
        }
        function restoreRange(){
          ed.focus();
          if(!savedRange) return;
          try {
            var sel = window.getSelection();
            sel.removeAllRanges(); sel.addRange(savedRange);
          } catch(e) {}
        }
        function cmd(name, val){
          restoreRange();
          try { document.execCommand(name, false, val == null ? null : val); } catch(e) {}
          syncFromEditor(); saveRange();
        }
        function cmdCss(name, val){
          restoreRange();
          try {
            document.execCommand("styleWithCSS", false, true);
            document.execCommand(name, false, val);
            document.execCommand("styleWithCSS", false, false);
          } catch(e) {}
          syncFromEditor(); saveRange();
        }
        /* Ukuran huruf memakai span bergaya sendiri: execCommand
           fontSize Firefox hanya mengenal skala lama 1–7, bukan pt.
           Beda dari Tahap 4: pada varian LITERAL tidak ada penanda
           U+200B untuk seleksi terlipat — penanda itu akan bocor ke
           tulang punggung (varian normalisasi membuangnya, varian
           literal tidak). Sebagai gantinya (G4, keputusan D-6), pada
           seleksi terlipat disisipkan span bergaya yang BENAR-BENAR
           KOSONG: serialisasi hanya membaca simpul teks, jadi span
           kosong menyumbang string kosong dan huruf yang kemudian
           diketik di dalamnya adalah teks biasa — identitas tulang
           punggung terjaga. Bila peramban terbukti tidak menahan
           karet di dalam span kosong itu, span dibuang dan baris
           petunjuk ditampilkan — tidak ada lagi kegagalan diam-diam. */
        function applyFontSize(pt){
          restoreRange();
          var sel = window.getSelection();
          if(!sel || !sel.rangeCount) return;
          var range = sel.getRangeAt(0);
          var span = document.createElement("span");
          span.style.fontSize = pt + "pt";
          try {
            if(range.collapsed){
              /* Tepi blok (D-6): bila karet menempel pada spasi yang persis
                 di awal/akhir teks sebuah blok, span kosong TIDAK aman —
                 normalisasi peramban menghapus spasi tepi itu begitu
                 pengguna mengetik (terbukti di QA), jadi teks akan berubah.
                 Di posisi tepi ini paket tidak menyisipkan span sama
                 sekali dan menampilkan petunjuk jujur; ukuran tetap bisa
                 diterapkan dengan memilih teksnya (jalur seleksi aman).
                 Di semua posisi lain span kosong dipakai seperti biasa. */
              var atEdge = false;
              try {
                var sc = range.startContainer, so = range.startOffset;
                if(sc && sc.nodeType === 3 && sc.nodeValue){
                  var blk = sc.parentNode;
                  while(blk && blk !== ed && !/^(P|DIV|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(blk.tagName || "")) blk = blk.parentNode;
                  if(blk && blk !== ed){
                    var firstT = null, lastT = null;
                    (function walkT(n){ for(var i = 0; i < n.childNodes.length; i++){ var c = n.childNodes[i]; if(c.nodeType === 3){ if(c.nodeValue){ if(!firstT) firstT = c; lastT = c; } } else if(c.nodeType === 1 && !/^(TABLE|UL|OL)$/.test(c.tagName)) walkT(c); } })(blk);
                    if(lastT === sc && so === sc.nodeValue.length && so > 0 && sc.nodeValue.charAt(so - 1) === " ") atEdge = true;
                    else if(firstT === sc && so === 0 && sc.nodeValue.charAt(0) === " ") atEdge = true;
                  }
                }
              } catch(eC) { atEdge = false; }
              if(atEdge){ showHint(); return; }
              range.insertNode(span);
              var r0 = document.createRange();
              r0.setStart(span, 0); r0.collapse(true);
              sel.removeAllRanges(); sel.addRange(r0);
              var okSpan = !!(span.parentNode && ed.contains(span));
              var chk = window.getSelection();
              var okCaret = okSpan && !!(chk && chk.rangeCount && span.contains(chk.getRangeAt(0).startContainer));
              if(!okSpan || !okCaret){
                if(span.parentNode) span.parentNode.removeChild(span);
                showHint();
                return;
              }
              hideHint();
            } else {
              span.appendChild(range.extractContents());
              range.insertNode(span);
              var r3 = document.createRange();
              r3.selectNodeContents(span);
              sel.removeAllRanges(); sel.addRange(r3);
            }
          } catch(e) { return; }
          syncFromEditor(); saveRange();
        }
        function leafBlocks(){
          var out = [];
          var sel = window.getSelection();
          if(!sel || !sel.rangeCount) return out;
          var range = sel.getRangeAt(0);
          var all = ed.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th");
          for(var i=0;i<all.length;i++){
            var b = all[i];
            var hit = false;
            try { hit = range.intersectsNode(b); } catch(e) { hit = false; }
            if(!hit) continue;
            if(b.querySelector("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th")) continue;
            out.push(b);
          }
          return out;
        }
        function blockStyle(fn){
          restoreRange();
          leafBlocks().forEach(fn);
          syncFromEditor(); saveRange();
        }
        function edIndent(delta){
          blockStyle(function(b){
            var ml = Math.max(0, wiEdPxLen(b.style.marginLeft) + delta);
            b.style.marginLeft = ml ? ml + "px" : "";
            if(ml === 0 && b.getAttribute("data-wied-hang")){
              b.removeAttribute("data-wied-hang");
              b.style.textIndent = "";
            }
          });
        }
        function edHangToggle(){
          blockStyle(function(b){
            var ml = wiEdPxLen(b.style.marginLeft);
            if(b.getAttribute("data-wied-hang")){
              b.removeAttribute("data-wied-hang");
              b.style.textIndent = "";
              ml = Math.max(0, ml - 24);
              b.style.marginLeft = ml ? ml + "px" : "";
            } else {
              b.setAttribute("data-wied-hang", "1");
              b.style.marginLeft = (ml + 24) + "px";
              b.style.textIndent = "-24px";
            }
          });
        }
        function edRemoveFormat(){
          var blocks = leafBlocks();
          cmd("removeFormat");
          blocks.forEach(function(b){
            b.style.lineHeight = ""; b.style.marginTop = ""; b.style.marginBottom = "";
            b.style.marginLeft = ""; b.style.textIndent = ""; b.style.textAlign = "";
            b.removeAttribute("data-wied-hang");
          });
          syncFromEditor();
        }
        /* ---------- Pembersih tempelan (daftar putih) ----------
           Salinan persis penyaring Tahap 4 (daftar tag/gaya yang sama). */
        var ED_OK_TAGS = { P:1, DIV:1, BR:1, B:1, STRONG:1, I:1, EM:1, U:1, S:1, STRIKE:1, SUB:1, SUP:1, SPAN:1, UL:1, OL:1, LI:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1, PRE:1, A:1 };
        var ED_DROP_TAGS = { SCRIPT:1, STYLE:1, IFRAME:1, OBJECT:1, EMBED:1, LINK:1, META:1, TITLE:1, IMG:1, VIDEO:1, AUDIO:1, SOURCE:1, TRACK:1, CANVAS:1, SVG:1, MATH:1, FORM:1, INPUT:1, BUTTON:1, TEXTAREA:1, SELECT:1, OPTION:1, HEAD:1, HR:1, AREA:1, BASE:1, PARAM:1 };
        function edUnwrap(el){
          var parent = el.parentNode;
          if(!parent) return;
          while(el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        function edCleanChildren(node){
          Array.prototype.slice.call(node.childNodes).forEach(function(k){
            if(k.nodeType === 8){ node.removeChild(k); return; }
            if(k.nodeType !== 1) return;
            var tag = k.tagName;
            if(ED_DROP_TAGS[tag]){ node.removeChild(k); return; }
            var styleAttr = k.getAttribute("style") || "";
            var hrefAttr = k.getAttribute("href") || "";
            var faceAttr = k.getAttribute("face") || "";
            edCleanChildren(k);
            if(tag === "FONT"){
              var sp = document.createElement("span");
              var st = wiEdFilterStyle(styleAttr, "inline");
              if(faceAttr && /^[A-Za-z0-9 ,\-']+$/.test(faceAttr))
                st = (st ? st + "; " : "") + "font-family: " + faceAttr;
              if(st) sp.setAttribute("style", st);
              while(k.firstChild) sp.appendChild(k.firstChild);
              k.parentNode.replaceChild(sp, k);
              return;
            }
            if(!ED_OK_TAGS[tag]){ edUnwrap(k); return; }
            var keep = "";
            if(tag === "SPAN") keep = wiEdFilterStyle(styleAttr, "inline");
            else if(WI_ED_BLOCK_TAGS[tag]) keep = wiEdFilterStyle(styleAttr, "block");
            while(k.attributes && k.attributes.length) k.removeAttribute(k.attributes[0].name);
            if(keep) k.setAttribute("style", keep);
            if(tag === "A"){
              if(/^(https?:|mailto:)/i.test(hrefAttr)){
                k.setAttribute("href", hrefAttr);
                k.setAttribute("rel", "noopener");
              } else edUnwrap(k);
            }
          });
        }
        function edCleanFragment(holder){
          Array.prototype.slice.call(holder.querySelectorAll("table")).forEach(function(tbl){
            Array.prototype.slice.call(tbl.querySelectorAll("td,th")).forEach(function(cell){
              var p = document.createElement("p");
              while(cell.firstChild) p.appendChild(cell.firstChild);
              if(cell.parentNode) cell.parentNode.replaceChild(p, cell);
            });
            edUnwrap(tbl);
          });
          edCleanChildren(holder);
        }
        ed.addEventListener("paste", function(e){
          e.preventDefault();
          var cd = e.clipboardData || window.clipboardData;
          var html = "", text = "";
          try {
            if(cd){ html = cd.getData("text/html") || ""; text = cd.getData("text/plain") || ""; }
          } catch(err) {}
          ed.focus();
          if(html){
            try {
              var holder = document.createElement("div");
              holder.innerHTML = html;
              edCleanFragment(holder);
              var clean = holder.innerHTML;
              if(clean) document.execCommand("insertHTML", false, clean);
              else if(text) document.execCommand("insertText", false, text);
            } catch(err) {
              if(text) document.execCommand("insertText", false, text);
            }
          } else if(text){
            try { document.execCommand("insertText", false, text); } catch(err) {}
          }
          syncFromEditor(); saveRange();
        });
        ed.addEventListener("input", function(){ syncFromEditor(); });
        document.addEventListener("selectionchange", function(){
          var sel = window.getSelection();
          if(sel && sel.rangeCount && ed.contains(sel.getRangeAt(0).commonAncestorContainer)){ saveRange(); queueReflect(); }
        });
        /* Bilah alat: mousedown tombol tidak boleh mencuri seleksi
           editor; seleksi selalu disnapshot agar perintah berlaku pada
           teks yang dipilih pengguna, termasuk sesudah fokus berpindah
           ke select. */
        bar.addEventListener("mousedown", function(e){
          saveRange();
          var t = e.target;
          if(t && t.closest && t.closest("button")) e.preventDefault();
        });
        bar.addEventListener("click", function(e){
          var t = e.target;
          var b = (t && t.closest) ? t.closest("button[data-cmd]") : null;
          if(!b) return;
          var c = b.getAttribute("data-cmd");
          if(c === "indentIn") edIndent(24);
          else if(c === "indentOut") edIndent(-24);
          else if(c === "hanging") edHangToggle();
          else if(c === "removeFormat") edRemoveFormat();
          else if(c.indexOf("justify") === 0){
            /* Firefox (styleWithCSS mati) menulis perataan sebagai
               atribut align=; normalkan ke style text-align agar
               seragam dengan perintah blok lain dan dipertahankan
               penyaring tempel (text-align ada di daftar putih blok). */
            var blocks = leafBlocks();
            cmd(c);
            blocks.forEach(function(bl){
              var al = bl.getAttribute("align");
              if(al){ bl.style.textAlign = al; bl.removeAttribute("align"); }
            });
            syncFromEditor();
          }
          else cmd(c);
        });
        bar.addEventListener("change", function(e){
          var t = e.target;
          if(!t || !t.getAttribute) return;
          var k = t.getAttribute("data-wied");
          var v = t.value;
          if(!k || !v) return;
          if(k === "style"){ cmd("formatBlock", v); t.value = ""; }
          else if(k === "font"){ cmdCss("fontName", v); }
          else if(k === "size"){ applyFontSize(v); }
          else if(k === "leading"){ blockStyle(function(b){ b.style.lineHeight = v; }); t.value = ""; }
          else if(k === "spaceBefore"){ blockStyle(function(b){ b.style.marginTop = v + "pt"; }); t.value = ""; }
          else if(k === "spaceAfter"){ blockStyle(function(b){ b.style.marginBottom = v + "pt"; }); t.value = ""; }
          else if(k === "fore"){ cmdCss("foreColor", v); }
          else if(k === "hilite"){ cmdCss("hiliteColor", v); }
        });
        /* ---------- Paket Toolbar: Cari & Ganti (G1), Tautan (G2), Refleksi (G3) ----------
           Tulisan yang sama dengan lem Tahap 4 (pola duplikasi yang sudah
           ada), disesuaikan untuk varian LITERAL: pencarian/penggantian
           berjalan pada string tulang punggung permukaan ini, ditulis
           kembali lewat setter bawaan + peristiwa "input" persis seperti
           ketikan biasa. Navigasi menyeleksi lewat salinan pola slot
           ED-CORE (edUnitNodes/edStreamSlots di bawah) yang menghitung
           SETIAP karakter apa adanya — tanpa membuang U+200B/U+00A0 —
           sesuai wiEdSerializeLiteral, dan digulir di dalam kotak
           editor saja. */
        var util = wrap.querySelector("[data-wied-util]");
        var findPanel = wrap.querySelector('[data-wied-panel="find"]');
        var linkPanel = wrap.querySelector('[data-wied-panel="link"]');
        var findIn = wrap.querySelector("[data-wied-find]");
        var replIn = wrap.querySelector("[data-wied-repl]");
        var caseBox = wrap.querySelector("[data-wied-case]");
        var countEl = wrap.querySelector("[data-wied-count]");
        var urlIn = wrap.querySelector("[data-wied-url]");
        var ltextIn = wrap.querySelector("[data-wied-ltext]");
        var lmsgEl = wrap.querySelector("[data-wied-lmsg]");
        var hintEl = wrap.querySelector("[data-wied-hint]");
        var panelOpen = "";
        var hintOn = false;
        var findState = { offsets: [], idx: -1 };
        function syncUtilVis(){
          if(!util) return;
          util.hidden = !(mode === "editor" && (panelOpen !== "" || hintOn));
          if(findPanel) findPanel.hidden = panelOpen !== "find";
          if(linkPanel) linkPanel.hidden = panelOpen !== "link";
          if(hintEl) hintEl.hidden = !hintOn;
        }
        function showHint(){ hintOn = true; syncUtilVis(); }
        function hideHint(){ if(hintOn){ hintOn = false; syncUtilVis(); } }
        function needleNow(){ return ((findIn && findIn.value) || "").replace(/[\r\n]/g, ""); }
        function replNow(){ return ((replIn && replIn.value) || "").replace(/[\r\n]/g, ""); }
        function findRefresh(){
          var n = needleNow();
          findState.offsets = n ? wiEdFindOffsets(nativeGet.call(ta), n, !!(caseBox && caseBox.checked)) : [];
          if(findState.idx >= findState.offsets.length) findState.idx = findState.offsets.length - 1;
          var total = findState.offsets.length;
          if(countEl){
            countEl.textContent = !n ? "" :
              (total === 0 ? "Tidak ditemukan" :
                (findState.idx >= 0 ? (findState.idx + 1) + " dari " + total : total + " ditemukan"));
          }
          if(util){
            Array.prototype.forEach.call(util.querySelectorAll("[data-wied-act]"), function(b){
              var a = b.getAttribute("data-wied-act");
              if(a === "next" || a === "prev" || a === "one" || a === "all") b.disabled = (!n || total === 0);
            });
          }
        }
        function writeBackbone(next){
          ta.value = next;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
        function edScrollToRange(range){
          try {
            var r = range.getBoundingClientRect();
            var er = ed.getBoundingClientRect();
            if(!r.height && !r.width) return;
            ed.scrollTop += (r.top - er.top) - (ed.clientHeight / 2) + (r.height / 2);
          } catch(e) {}
        }
        /* Salinan pola unit/slot Tahap 4 untuk varian literal. */
        function edUnitNodes(){
          var units = [];
          var strayNodes = null;
          function flushStray(){
            if(strayNodes){
              var lines = wiEdWalkInline(strayNodes, [""]);
              if(/\S/.test(lines.join("\n"))) units.push({ nodes: strayNodes, phantomBr: null });
              strayNodes = null;
            }
          }
          function collect(node){
            var kids = node.childNodes || [];
            for(var i=0;i<kids.length;i++){
              var k = kids[i];
              if(wiEdIsBlock(k)){
                flushStray();
                if(WI_ED_CONTAINER_TAGS[k.tagName] && !WI_ED_BLOCK_TAGS[k.tagName]){ collect(k); continue; }
                var sub = k.childNodes || [];
                var hasBlock = false;
                for(var j=0;j<sub.length;j++){ if(wiEdIsBlock(sub[j])){ hasBlock = true; break; } }
                if(hasBlock){ collect(k); continue; }
                var last = sub[sub.length-1];
                units.push({ nodes: [k], phantomBr: (last && last.nodeType === 1 && last.tagName === "BR") ? last : null });
              } else {
                if(!strayNodes) strayNodes = [];
                strayNodes.push(k);
              }
            }
          }
          collect(ed);
          flushStray();
          return units;
        }
        function edStreamSlots(){
          var units = edUnitNodes();
          var slots = [];
          var endPoint = null;
          function walkNode(n, phantom){
            if(n.nodeType === 3){
              var v = n.nodeValue || "";
              for(var j=0;j<v.length;j++) slots.push({ node: n, off: j });
              if(v.length) endPoint = { node: n, off: v.length };
              return;
            }
            if(n.nodeType !== 1) return;
            if(n.tagName === "BR"){
              if(n === phantom) return;
              var parent = n.parentNode;
              if(!parent) return;
              var idx = Array.prototype.indexOf.call(parent.childNodes, n);
              slots.push({ node: parent, off: idx });
              endPoint = { node: parent, off: idx + 1 };
              return;
            }
            var kids = n.childNodes;
            for(var i=0;i<kids.length;i++) walkNode(kids[i], phantom);
          }
          units.forEach(function(u, ui){
            if(ui > 0 && endPoint) slots.push(endPoint, endPoint);
            u.nodes.forEach(function(n){ walkNode(n, u.phantomBr); });
            if(!endPoint && u.nodes.length) endPoint = { node: u.nodes[0], off: 0 };
          });
          slots.push(endPoint);
          return slots;
        }
        function selectBackboneRange(start, end){
          var slots = edStreamSlots();
          var a = slots[start], b = slots[end];
          if(!a || !b) return false;
          var range = document.createRange();
          try { range.setStart(a.node, a.off); range.setEnd(b.node, b.off); } catch(e) { return false; }
          var sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
          edScrollToRange(range);
          saveRange();
          return true;
        }
        function findGo(dir){
          findRefresh();
          var total = findState.offsets.length;
          if(!total) return;
          var i = findState.idx;
          i = i < 0 ? (dir > 0 ? 0 : total - 1) : (i + dir + total) % total;
          findState.idx = i;
          var o = findState.offsets[i];
          if(mode === "editor") selectBackboneRange(o[0], o[1]);
          findRefresh();
        }
        function findReplaceOne(){
          findRefresh();
          var offs = findState.offsets;
          if(!offs.length) return;
          var i = findState.idx >= 0 ? findState.idx : 0;
          var o = offs[i];
          var text = nativeGet.call(ta);
          writeBackbone(text.slice(0, o[0]) + replNow() + text.slice(o[1]));
          findState.idx = i;
          findRefresh();
          var no = findState.offsets;
          if(no.length){
            var j = Math.min(i, no.length - 1);
            findState.idx = j;
            if(mode === "editor") selectBackboneRange(no[j][0], no[j][1]);
            findRefresh();
          } else savedRange = null;
        }
        function findReplaceAll(){
          var n = needleNow();
          if(!n) return;
          var res = wiEdReplaceAll(nativeGet.call(ta), n, replNow(), !!(caseBox && caseBox.checked));
          if(res.count) writeBackbone(res.text);
          findState.idx = -1;
          findRefresh();
          if(countEl) countEl.textContent = res.count ? ("Diganti di " + res.count + " tempat.") : "Tidak ditemukan";
        }
        var findTimer = null;
        if(findIn) findIn.addEventListener("input", function(){
          if(findTimer) clearTimeout(findTimer);
          findTimer = setTimeout(function(){ findState.idx = -1; findRefresh(); }, 200);
        });
        if(findIn) findIn.addEventListener("keydown", function(e){
          if(e.key === "Enter"){ e.preventDefault(); findGo(1); }
        });
        if(caseBox) caseBox.addEventListener("change", function(){ findState.idx = -1; findRefresh(); });
        function prepLinkPanel(){
          if(lmsgEl) lmsgEl.textContent = "";
          var txt = "";
          try { if(savedRange && !savedRange.collapsed) txt = savedRange.toString(); } catch(e) {}
          if(ltextIn) ltextIn.value = txt;
        }
        function linkInsert(){
          var url = ((urlIn && urlIn.value) || "").trim();
          if(!wiEdLinkSchemeOk(url)){
            if(lmsgEl) lmsgEl.textContent = "Alamat harus diawali https://, http://, atau mailto:";
            return;
          }
          if(lmsgEl) lmsgEl.textContent = "";
          restoreRange();
          var sel = window.getSelection();
          if(!sel || !sel.rangeCount) return;
          var range = sel.getRangeAt(0);
          if(!ed.contains(range.commonAncestorContainer)) return;
          var a = document.createElement("a");
          a.setAttribute("href", url);
          a.setAttribute("rel", "noopener");
          var label = ((ltextIn && ltextIn.value) || "").trim();
          try {
            if(range.collapsed){
              a.appendChild(document.createTextNode(label || url));
              range.insertNode(a);
            } else if(label && range.toString() !== label){
              range.deleteContents();
              a.appendChild(document.createTextNode(label));
              range.insertNode(a);
            } else {
              a.appendChild(range.extractContents());
              range.insertNode(a);
            }
            var r2 = document.createRange();
            r2.setStartAfter(a); r2.collapse(true);
            sel.removeAllRanges(); sel.addRange(r2);
          } catch(e) { return; }
          panelOpen = ""; syncUtilVis();
          syncFromEditor(); saveRange();
        }
        function openPanel(which){
          if(which === "link") prepLinkPanel();
          panelOpen = (panelOpen === which) ? "" : which;
          syncUtilVis();
          if(panelOpen === "find"){ findRefresh(); if(findIn) try { findIn.focus(); } catch(e) {} }
          if(panelOpen === "link" && urlIn) try { urlIn.focus(); } catch(e) {}
        }
        bar.addEventListener("click", function(e){
          var t = e.target;
          var b = (t && t.closest) ? t.closest("button[data-wied-open]") : null;
          if(b) openPanel(b.getAttribute("data-wied-open"));
        });
        if(util) util.addEventListener("click", function(e){
          var t = e.target;
          var b = (t && t.closest) ? t.closest("button[data-wied-act]") : null;
          if(!b || b.disabled) return;
          var a = b.getAttribute("data-wied-act");
          if(a === "close"){ panelOpen = ""; syncUtilVis(); }
          else if(a === "next") findGo(1);
          else if(a === "prev") findGo(-1);
          else if(a === "one") findReplaceOne();
          else if(a === "all") findReplaceAll();
          else if(a === "insert") linkInsert();
        });
        if(util) util.addEventListener("keydown", function(e){
          if(e.key === "Escape"){ panelOpen = ""; syncUtilVis(); }
        });
        /* ---------- G3: refleksi keadaan tombol (baca-murni, sama
           seperti lem Tahap 4; hanya menulis ke bilah alat) ---------- */
        var reflectQueued = false;
        function queueReflect(){
          if(reflectQueued) return;
          reflectQueued = true;
          if(window.requestAnimationFrame) window.requestAnimationFrame(function(){ edReflect(); });
          else edReflect();
        }
        function edReflect(){
          reflectQueued = false;
          try {
            var sel = window.getSelection();
            if(!sel || !sel.rangeCount) return;
            var range = sel.getRangeAt(0);
            if(!ed.contains(range.startContainer)) return;
            var anchor = range.startContainer;
            var el = anchor.nodeType === 1 ? anchor : anchor.parentNode;
            var on = { bold: false, italic: false, underline: false, strikeThrough: false, subscript: false, superscript: false };
            var n = el;
            while(n && n !== ed){
              var tg = n.tagName;
              if(tg === "B" || tg === "STRONG") on.bold = true;
              else if(tg === "I" || tg === "EM") on.italic = true;
              else if(tg === "U") on.underline = true;
              else if(tg === "S" || tg === "STRIKE") on.strikeThrough = true;
              else if(tg === "SUB") on.subscript = true;
              else if(tg === "SUP") on.superscript = true;
              n = n.parentNode;
            }
            if(el){
              var cs = window.getComputedStyle(el);
              if(cs.fontWeight === "bold" || parseInt(cs.fontWeight, 10) >= 600) on.bold = true;
              if(cs.fontStyle === "italic" || cs.fontStyle === "oblique") on.italic = true;
              var td = cs.textDecorationLine || cs.textDecoration || "";
              if(td.indexOf("underline") >= 0) on.underline = true;
              if(td.indexOf("line-through") >= 0) on.strikeThrough = true;
              if(cs.verticalAlign === "sub") on.subscript = true;
              if(cs.verticalAlign === "super") on.superscript = true;
              /* D-5: warna teks hanya bila terbaca rgb() tunggal. */
              var m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(cs.color || "");
              if(m){
                var hex = "#" + [m[1], m[2], m[3]].map(function(x){ var h = Number(x).toString(16); return h.length < 2 ? "0" + h : h; }).join("");
                var fore = bar.querySelector('[data-wied="fore"]');
                if(fore) fore.value = hex;
              }
              var fontSel = bar.querySelector('[data-wied="font"]');
              if(fontSel){
                var fam = (cs.fontFamily || "").split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
                var hit = "";
                Array.prototype.forEach.call(fontSel.options, function(o){
                  if(!o.value) return;
                  if(o.value.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase() === fam) hit = o.value;
                });
                fontSel.value = hit;
              }
              var sizeSel = bar.querySelector('[data-wied="size"]');
              if(sizeSel){
                var pt = parseFloat(cs.fontSize) * 72 / 96;
                var hitS = "";
                Array.prototype.forEach.call(sizeSel.options, function(o){
                  if(o.value && Math.abs(parseFloat(o.value) - pt) < 0.01) hitS = o.value;
                });
                sizeSel.value = hitS;
              }
            }
            var blocks = leafBlocks();
            var blk = blocks.length ? blocks[0] : null;
            var align = "", listCmd = "", hang = false;
            if(blk){
              align = window.getComputedStyle(blk).textAlign || "";
              var p = blk;
              while(p && p !== ed){
                if(p.tagName === "UL"){ listCmd = "insertUnorderedList"; break; }
                if(p.tagName === "OL"){ listCmd = "insertOrderedList"; break; }
                p = p.parentNode;
              }
              hang = !!blk.getAttribute("data-wied-hang");
              var styleSel = bar.querySelector('[data-wied="style"]');
              if(styleSel){
                var map = { P: "P", H1: "H1", H2: "H2", H3: "H3", BLOCKQUOTE: "BLOCKQUOTE" };
                styleSel.value = map[blk.tagName] || "";
              }
            }
            var want = {
              bold: on.bold, italic: on.italic, underline: on.underline,
              strikeThrough: on.strikeThrough, subscript: on.subscript, superscript: on.superscript,
              justifyLeft: align === "left" || align === "start",
              justifyCenter: align === "center",
              justifyRight: align === "right" || align === "end",
              justifyFull: align === "justify",
              insertUnorderedList: listCmd === "insertUnorderedList",
              insertOrderedList: listCmd === "insertOrderedList",
              hanging: hang
            };
            Object.keys(want).forEach(function(c){
              var b = bar.querySelector('button[data-cmd="' + c + '"]');
              if(!b) return;
              b.classList.toggle("is-on", !!want[c]);
              b.setAttribute("aria-pressed", want[c] ? "true" : "false");
            });
          } catch(e) {}
        }
        bar.addEventListener("click", function(){ queueReflect(); });
        bar.addEventListener("change", function(){ queueReflect(); });
        /* ---------- Mode Editor | Teks polos ---------- */
        var modeBtns = Array.prototype.slice.call(wrap.querySelectorAll("[data-wied-mode]"));
        function setMode(m){
          if(m === mode) return;
          if(m === "plain") syncFromEditor();
          mode = m;
          var edOn = m === "editor";
          bar.hidden = !edOn;
          ed.hidden = !edOn;
          syncUtilVis();
          ta.classList.toggle("ed-backbone-off", edOn);
          modeBtns.forEach(function(b){
            var on = b.getAttribute("data-wied-mode") === m;
            b.classList.toggle("is-on", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          if(edOn){ renderFromBackbone(); ed.focus(); }
          else ta.focus();
        }
        modeBtns.forEach(function(b){
          b.addEventListener("click", function(){ setMode(b.getAttribute("data-wied-mode")); });
        });
        /* ---------- Mulai ---------- */
        try { document.execCommand("styleWithCSS", false, false); } catch(e) {}
        renderFromBackbone();
        ta.classList.add("ed-backbone-off");
      }
      var ED_LITERAL = (typeof wiEdSerializeLiteral === "function") ? wiEdSerializeLiteral : wiEdSerialize;
      var ED_INSTANCES = [
        ["input-teks", "ed-surface-input-teks", "Teks yang diperiksa"],
        ["wf-input", "ed-surface-wf-input", "Teks yang dianalisis karakteristiknya"],
        ["cmp-a", "ed-surface-cmp-a", "Teks Dokumen A"],
        ["cmp-b", "ed-surface-cmp-b", "Teks Dokumen B"],
        ["p7-quick-text", "ed-surface-p7-quick-text", "Teks yang ingin diperiksa"],
        ["ocr-out", "ed-surface-ocr-out", "Hasil OCR (dapat disunting)"]
      ];
      ED_INSTANCES.forEach(function(cfg){
        try {
          saksaraEdAttach($(cfg[0]), { serialize: ED_LITERAL, surfaceId: cfg[1], ariaLabel: cfg[2] });
        } catch(e) { /* satu permukaan gagal tidak boleh mematahkan yang lain */ }
      });
    })();

  