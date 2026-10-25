/* Clipboard helper with a textarea fallback. */
(() => {
  const root = window.YTP = window.YTP || {};
  root.copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const field = document.createElement("textarea");
      field.value = text; field.setAttribute("readonly", ""); field.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.append(field); field.select();
      const ok = document.execCommand("copy"); field.remove();
      if (!ok) throw new Error("The browser blocked clipboard access. Click the page once and try again.");
    }
  };
})();
