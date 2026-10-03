/**
 * FR-056: tema diterapkan SEBELUM paint pertama agar tidak berkedip putih
 * saat mode gelap.
 *
 * Diimplementasikan sebagai skrip inline mungil, bukan pustaka: `next-themes`
 * menambah bundel klien untuk perilaku yang hanya butuh belasan baris. Skrip ini
 * berjalan sinkron di <head>, jadi kelas `dark` sudah terpasang saat CSS dinilai.
 */
const SCRIPT = `
(function(){try{
var s=localStorage.getItem('theme');
var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();
`.trim()

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
