import { test, expect } from '@playwright/test';

test('alta de suscripcion - magnesio bisglicinato', async ({ page }) => {
  await page.goto('https://mp-subscriptions.myshopify.com/');

  if (page.url().includes('/password')) {
    await page.getByLabel('Introduce la contraseña de la tienda').fill('latech');
    await page.getByRole('button', { name: 'Ingresar' }).click();
  }

  await page.getByRole('link', { name: 'Comprar' }).first().click();
  const botonCerrar = page.getByRole('button', { name: 'Cerrar' });
  if (await botonCerrar.isVisible({ timeout: 5000 }).catch(() => false)) {
    await botonCerrar.click();
  }
  await page.getByRole('link', { name: 'Magnesio Bisglicinato.' }).first().click();
  await page.locator('span').filter({ hasText: '20' }).first().click();
  await page.getByLabel('Frecuencia de entrega').selectOption('1:months');
  await page.getByRole('button', { name: 'Suscribirme' }).click();
  await page.getByRole('textbox', { name: 'Correo electrónico' }).click();
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('angel.arellan@test.com');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('angel');
  await page.getByRole('textbox', { name: 'Apellido' }).click();
  await page.getByRole('textbox', { name: 'Apellido' }).fill('arellan');
  await page.getByLabel('País / Región').selectOption('AR');
  await page.getByRole('textbox', { name: 'Dirección' }).click();
  await page.getByRole('textbox', { name: 'Dirección' }).fill('mancol 8534');
  await page.getByRole('textbox', { name: 'Casa, apartamento, etc. (' }).click();
  await page.getByRole('textbox', { name: 'Casa, apartamento, etc. (' }).fill('casa');
  await page.getByRole('textbox', { name: 'Código postal' }).click();
  await page.getByRole('textbox', { name: 'Código postal' }).fill('5022');
  await page.getByRole('textbox', { name: 'Ciudad' }).click();
  await page.getByRole('textbox', { name: 'Ciudad' }).fill('cordoba');
  await page.getByLabel('Provincia / Estado').selectOption('Córdoba');
  await page.getByRole('textbox', { name: 'Teléfono' }).click();
  await page.getByRole('textbox', { name: 'Teléfono' }).fill('3527713838');
});
