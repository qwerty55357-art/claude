// Сборка демо-проекта через настоящий интерфейс
module.exports=async function setup(p){
  await p.fill('#i-client','Иванов, гостиная');
  await p.fill('#i-wname','Стена с ТВ');
  await p.fill('#i-w','4200'); await p.fill('#i-h','2600');
  // материал и расцветка
  await p.locator('#i-cw-btn .mat-pick-btn').click();
  await p.locator('#mat-menu .mp-tile',{hasText:'8190'}).first().click();
  await p.waitForTimeout(300);
  // проёмы: окно уносим вправо, добавляем дверь слева
  await p.fill('[data-op="1"] [data-k="off"]','2500');
  await p.click('#btn-add-op'); await p.waitForTimeout(200);
  const d=p.locator('[data-op="2"]');
  await d.locator('[data-k="kind"]').selectOption('door');
  await d.locator('[data-k="off"]').fill('400');
  await d.locator('[data-k="w"]').fill('900');
  await d.locator('[data-k="ylow"]').fill('0');
  await d.locator('[data-k="yhigh"]').fill('2100');
  await p.waitForTimeout(400);
};
module.exports.second=async function(p){
  await p.click('[data-cpadd="E"]'); await p.waitForTimeout(300);
  await p.fill('#i-wname','Боковая стена');
  await p.fill('#i-w','3000'); await p.fill('#i-h','2600');
  await p.waitForTimeout(300);
  await p.click('[data-cpjump="1"]'); await p.waitForTimeout(300);
  await p.click('[data-cpadd="NE"]'); await p.waitForTimeout(400);
};
