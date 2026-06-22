let loaderHidden = false;

function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    const l = document.getElementById("loader"); if (!l) return;
    l.classList.add("hide");
    setTimeout(() => { l.style.display = "none"; }, 650);
}

function buildWheat() {
    const svg = document.getElementById("wheat"); if (!svg) return; const NS = "http://www.w3.org/2000/svg";
    const W = 600, H = 150, n = 28;
    const ground = document.createElementNS(NS, "line");
    ground.setAttribute("x1", 0); ground.setAttribute("y1", H); ground.setAttribute("x2", W); ground.setAttribute("y2", H);
    ground.setAttribute("class", "ground"); svg.appendChild(ground);
    for (let i = 0; i < n; i++) {
        const x = 12 + i * (W - 24) / (n - 1) + (Math.random() * 8 - 4); const h = 70 + Math.random() * 58;
        const g = document.createElementNS(NS, "g"); g.setAttribute("transform", `translate(${x.toFixed(1)},${H})`);
        const sway = document.createElementNS(NS, "g"); sway.setAttribute("class", "stalk-sway");
        sway.style.animationDelay = (-(x / W) * 2.6).toFixed(2) + "s";
        sway.style.animationDuration = (2.3 + Math.random() * 0.9).toFixed(2) + "s";
        const cx = (Math.random() * 7 - 3.5).toFixed(1);
        const stem = document.createElementNS(NS, "path");
        stem.setAttribute("d", `M0,0 Q${cx},${(-h * 0.6).toFixed(1)} 0,${(-h).toFixed(1)}`);
        stem.setAttribute("class", "stem"); sway.appendChild(stem);
        for (let k = 0; k < 7; k++) {
            const t = k / 7, gy = -h + t * h * 0.44, side = k % 2 ? 1 : -1;
            const e = document.createElementNS(NS, "ellipse");
            e.setAttribute("cx", (side * 4).toFixed(1)); e.setAttribute("cy", gy.toFixed(1));
            e.setAttribute("rx", 3.1); e.setAttribute("ry", 6);
            e.setAttribute("transform", `rotate(${side * 26} ${(side * 4).toFixed(1)} ${gy.toFixed(1)})`);
            e.setAttribute("class", "grain" + (k % 3 === 0 ? " lite" : "")); sway.appendChild(e);
        }
        const tip = document.createElementNS(NS, "ellipse");
        tip.setAttribute("cx", 0); tip.setAttribute("cy", (-h - 3).toFixed(1));
        tip.setAttribute("rx", 2.4); tip.setAttribute("ry", 8);
        tip.setAttribute("class", "grain lite"); sway.appendChild(tip);
        g.appendChild(sway); svg.appendChild(g);
    }
}
