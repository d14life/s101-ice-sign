// Вписывает артборд 1120×780 в окно любого размера.
const fit = () => document.documentElement.style.setProperty(
  '--s', Math.min(innerWidth / 1120, innerHeight / 780).toFixed(5));
addEventListener('resize', fit, { passive: true });
fit();

// Внутри iframe (галерея, витрина 30 экранов) кнопка «назад» лишняя —
// там ссылкой служит вся карточка.
if (window.top !== window.self) document.querySelector('.back')?.remove();
