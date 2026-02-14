(function () {
  const display = document.getElementById("ep-display");
  const startBtn = document.getElementById("ep-start");
  const resetBtn = document.getElementById("ep-reset");

  let elapsed = 0;
  let interval = null;

  function format(ms) {
    const mins = String(Math.floor(ms / 60000)).padStart(2, "0");
    const secs = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    const cs = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
    return mins + ":" + secs + "." + cs;
  }

  function render() {
    display.textContent = format(elapsed);
  }

  startBtn.addEventListener("click", function () {
    if (interval) {
      clearInterval(interval);
      interval = null;
      startBtn.textContent = "Start";
      startBtn.classList.remove("active");
    } else {
      const t0 = Date.now() - elapsed;
      interval = setInterval(function () {
        elapsed = Date.now() - t0;
        render();
      }, 10);
      startBtn.textContent = "Stop";
      startBtn.classList.add("active");
    }
  });

  resetBtn.addEventListener("click", function () {
    if (interval) {
      clearInterval(interval);
      interval = null;
      startBtn.textContent = "Start";
      startBtn.classList.remove("active");
    }
    elapsed = 0;
    render();
  });

  render();
})();
