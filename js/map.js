let mapZoom = null, mapSvgSel = null, mapFitTransform = null;

function colorFor(pct) {
    if (pct <= 0) return "#D6CFBC";
    if (pct >= 1) return "#3C6B4A";
    const c1 = [242, 195, 87], c2 = [185, 127, 24], m = i => Math.round(c1[i] + (c2[i] - c1[i]) * pct);
    return `rgb(${m(0)},${m(1)},${m(2)})`;
}

const ID_MAP = {
    "KZ-AKM": "AKM", "KZ-AKT": "AKT", "KZ-ALM": "ALM", "KZ-ALA": "ALM",
    "KZ-VOS": "VKO", "KZ-ABA": "ABA", "KZ-ZAP": "ZKO", "KZ-KAR": "KAR",
    "KZ-KUS": "KOS", "KZ-PAV": "PAV", "KZ-SEV": "SKO"
};

function featCode(f) {
    const id = String(f.id || (f.properties && (f.properties.id || f.properties.shapeISO)) || "").toUpperCase();
    if (ID_MAP[id]) return ID_MAP[id];
    return matchCode((f.properties && (f.properties.name || f.properties.NAME_1 || f.properties.shapeName)) || "");
}

function matchCode(nm) {
    const s = String(nm).toLowerCase();
    if (s.includes("akmola") || s.includes("aqmola")) return "AKM";
    if (s.includes("abai") || s.includes("abay")) return "ABA";
    if (s.includes("aktobe") || s.includes("aqtöbe") || s.includes("aqtobe") || s.includes("aktyubin")) return "AKT";
    if (s.includes("almaty") && !s.includes("city") && !s.includes("qala")) return "ALM";
    if (s.includes("east kazakh") || s.includes("vostochno") || s.includes("shyghys") || s.includes("şyğys")) return "VKO";
    if (s.includes("west kazakh") || s.includes("zapadno") || s.includes("batys")) return "ZKO";
    if (s.includes("north kazakh") || s.includes("severo") || s.includes("soltüstik") || s.includes("soltustik")) return "SKO";
    if (s.includes("karagand") || s.includes("qaragand")) return "KAR";
    if (s.includes("kostanay") || s.includes("qostanai") || s.includes("kustanay")) return "KOS";
    if (s.includes("pavlodar")) return "PAV";
    return null;
}

function regShort(name) {
    return name.replace("Восточно-Казахстанская", "ВКО").replace("Западно-Казахстанская", "ЗКО")
        .replace("Северо-Казахстанская", "СКО").replace("ская", " обл.").replace("ская", ".").trim();
}

function renderMap() {
    if (window.d3 && GEO && GEO.features && GEO.features.length > 0) renderGeo();
    else renderBubbles();
}

function renderGeo() {
    const svg = $("#map"); svg.innerHTML = ""; const NS = "http://www.w3.org/2000/svg";
    const proj = d3.geoMercator().fitExtent([[14, 16], [906, 464]], GEO);
    const gp = d3.geoPath(proj);
    const byCode = {}; D.regions.forEach(r => byCode[r.code] = r);
    const G = document.createElementNS(NS, "g"); G.setAttribute("id", "zoomG"); svg.appendChild(G);
    GEO.features.forEach(f => {
        const code = featCode(f); const rg = code ? byCode[code] : null;
        const vol = rg ? rg.rec[3] : 0, pct = rg && rg.limit ? rg.fin[2] / rg.limit : 0;
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", gp(f)); p.setAttribute("fill", vol > 0 ? colorFor(pct) : "#ECE6D5");
        p.setAttribute("stroke", "#FBFAF5"); p.setAttribute("stroke-width", "0.8");
        p.setAttribute("class", "geopath"); if (rg) p.dataset.code = rg.code;
        if (rg && vol > 0) {
            p.style.cursor = "pointer";
            p.addEventListener("mousemove", e => showTip(e, rg)); p.addEventListener("mouseleave", hideTip);
            p.addEventListener("click", () => openRegion(rg.code));
        }
        G.appendChild(p);
        if (vol > 0) {
            const c = gp.centroid(f);
            const lab = document.createElementNS(NS, "g"); lab.setAttribute("class", "glabg");
            lab.dataset.cx = c[0].toFixed(1); lab.dataset.cy = c[1].toFixed(1);
            lab.setAttribute("transform", `translate(${c[0].toFixed(1)},${c[1].toFixed(1)})`);
            const nm = regShort(rg.name), cntTxt = "СХТП " + rg.rec[0];
            const wMax = Math.max(nm.length * 6.6, cntTxt.length * 5.6) + 14;
            lab.appendChild(document.createElementNS(NS, "rect")); const pill = lab.lastChild;
            pill.setAttribute("class", "pill"); pill.setAttribute("x", (-wMax / 2).toFixed(1)); pill.setAttribute("y", "-13");
            pill.setAttribute("width", wMax.toFixed(1)); pill.setAttribute("height", "26"); pill.setAttribute("rx", "7");
            const t1 = document.createElementNS(NS, "text"); t1.setAttribute("class", "glab name"); t1.setAttribute("y", "-4"); t1.textContent = nm;
            const t2 = document.createElementNS(NS, "text"); t2.setAttribute("class", "glab cnt2"); t2.setAttribute("y", "6"); t2.textContent = cntTxt;
            lab.appendChild(t1); lab.appendChild(t2); G.appendChild(lab);
        }
    });
    const zoom = d3.zoom().scaleExtent([1, 9]).on("zoom", ev => {
        G.setAttribute("transform", ev.transform);
        const k = ev.transform.k;
        G.querySelectorAll(".glabg").forEach(l => l.setAttribute("transform",
            `translate(${l.dataset.cx},${l.dataset.cy}) scale(${(1 / k).toFixed(3)})`));
    });
    mapZoom = zoom; mapSvgSel = d3.select(svg);
    d3.select(svg).call(zoom).on("dblclick.zoom", null);
    mapFitTransform = d3.zoomIdentity;
    d3.select(svg).call(zoom.transform, mapFitTransform);
}

function renderBubbles() {
    const svg = $("#map"); svg.innerHTML = ""; const NS = "http://www.w3.org/2000/svg";
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M60,150 L150,110 L300,92 L470,72 L640,86 L800,112 L878,150 L880,178 L838,206 L856,236 L800,250 L772,300 L700,356 L688,406 L636,438 L548,452 L470,470 L380,470 L300,440 L236,448 L200,410 L150,420 L96,392 L62,356 L92,300 L60,250 L104,214 L66,196 L112,170 Z");
    p.setAttribute("class", "outline"); svg.appendChild(p);
    const maxVol = Math.max(1, ...D.regions.map(r => r.rec[3]));
    D.regions.forEach(rg => {
        const vol = rg.rec[3], pct = rg.limit ? rg.fin[2] / rg.limit : 0, rad = vol > 0 ? 14 + Math.sqrt(vol / maxVol) * 34 : 9;
        const g = document.createElementNS(NS, "g"); g.setAttribute("class", "bub"); g.dataset.code = rg.code;
        const ring = document.createElementNS(NS, "circle");
        ring.setAttribute("cx", rg.x); ring.setAttribute("cy", rg.y); ring.setAttribute("r", rad + 4);
        ring.setAttribute("class", "ring"); ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", vol > 0 ? colorFor(pct) : "#CFC9B8"); ring.setAttribute("opacity", vol > 0 ? ".25" : ".4");
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", rg.x); c.setAttribute("cy", rg.y); c.setAttribute("r", rad);
        c.setAttribute("class", "hit"); c.setAttribute("fill", vol > 0 ? colorFor(pct) : "#E4DECE");
        c.setAttribute("stroke", "#fff"); c.setAttribute("stroke-width", "2");
        g.appendChild(ring); g.appendChild(c);
        if (vol > 0) {
            const tx = document.createElementNS(NS, "text");
            tx.setAttribute("x", rg.x); tx.setAttribute("y", rg.y);
            tx.setAttribute("class", "cnt"); tx.setAttribute("font-size", rad > 22 ? "13" : "10"); tx.textContent = rg.rec[1]; g.appendChild(tx);
        }
        const lb = document.createElementNS(NS, "text");
        lb.setAttribute("x", rg.x); lb.setAttribute("y", rg.y + rad + 13); lb.setAttribute("class", "lab");
        lb.textContent = rg.name.replace("Восточно-Казахстанская", "ВКО").replace("Западно-Казахстанская", "ЗКО")
            .replace("Северо-Казахстанская", "СКО").replace("ская", "."); g.appendChild(lb);
        g.addEventListener("mousemove", e => showTip(e, rg)); g.addEventListener("mouseleave", hideTip);
        g.addEventListener("click", () => { if (vol > 0) openRegion(rg.code); });
        svg.appendChild(g);
    });
}

function mapZoomBy(f) { if (mapZoom && mapSvgSel) mapSvgSel.transition().duration(250).call(mapZoom.scaleBy, f); }
function mapZoomReset() { if (mapZoom && mapSvgSel && mapFitTransform) mapSvgSel.transition().duration(300).call(mapZoom.transform, mapFitTransform); }

function showTip(e, rg) {
    const tip = $("#maptip"); const pct = rg.limit ? rg.fin[2] / rg.limit * 100 : 0;
    tip.innerHTML = `<b>${rg.name}</b>
        <div class="l"><span>Заявок</span><span>${rg.rec[1] || 0}</span></div>
        <div class="l"><span>Объём заявок</span><span>${fmtT(rg.rec[3])} тонн</span></div>
        <div class="l"><span>Профинанс.</span><span>${fmtMlrd(rg.fin[2])} ₸</span></div>
        <div class="l"><span>Освоение лимита</span><span>${pct.toFixed(0)}%</span></div>`;
    tip.classList.add("show");
    const wrap = $(".mapwrap").getBoundingClientRect();
    let x = e.clientX - wrap.left + 14, y = e.clientY - wrap.top + 10;
    if (x > wrap.width - 180) x -= 200;
    tip.style.left = x + "px"; tip.style.top = y + "px";
}

function hideTip() { $("#maptip").classList.remove("show"); }
