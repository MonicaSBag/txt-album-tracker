// supabase/functions/delete-account/email-template.ts

export function buildDeletionEmailHtml({ name, email }: { name?: string; email: string }) {
  const greetingName = name ? name.split(" ")[0] : "MOA";
  const today = new Date().toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tu cuenta fue eliminada</title>
  </head>
  <body style="margin:0; padding:0; background-color:#0a0818; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0818; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color:#150f28; border:1px solid rgba(255,255,255,0.09); border-radius: 18px; overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="padding: 32px 32px 0; text-align:center;">
                <span style="display:inline-block; font-size: 11px; font-weight:700; letter-spacing: 3px; text-transform:uppercase; color:#ff5fa8;">
                  Archivo físico · MOA Collection
                </span>
                <h1 style="margin: 12px 0 0; font-size: 22px; line-height:1.25; color:#f3f0ff; font-weight:800;">
                  TOMORROW
                  <span style="background: linear-gradient(135deg, #9b6bff 0%, #ff5fa8 100%); -webkit-background-clip: text; background-clip: text; color:#9b6bff;">X</span>
                  TOGETHER
                </h1>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 24px 32px 0;">
                <div style="height:1px; background-color: rgba(255,255,255,0.09);"></div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 24px 32px 8px;">
                <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#f3f0ff;">
                  Hola ${greetingName},
                </p>
                <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#f3f0ff;">
                  Confirmamos que tu cuenta (<strong>${email}</strong>) y toda tu colección guardada
                  en <strong>TXT Album Tracker</strong> fueron eliminadas de forma permanente el ${today}.
                </p>
                <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#a39bc9;">
                  Esto incluyó tu registro de versiones físicas marcadas como "Lo tengo" y cualquier
                  dato asociado a tu cuenta de Google en la app. No queda nada guardado de tu lado.
                </p>
              </td>
            </tr>

            <!-- Info card -->
            <tr>
              <td style="padding: 8px 32px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius: 12px;">
                  <tr>
                    <td style="padding: 16px 18px;">
                      <p style="margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#ff5fa8;">
                        ¿Qué es TXT Album Tracker?
                      </p>
                      <p style="margin:0; font-size:13.5px; line-height:1.6; color:#a39bc9;">
                        Un tracker personal para llevar registro de las versiones físicas de los
                        álbumes de TOMORROW X TOGETHER (y solos de sus miembros) que ya tenés y
                        las que te faltan.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 16px 32px 8px;">
                <p style="margin:0; font-size:14px; line-height:1.6; color:#f3f0ff;">
                  Si en algún momento querés volver, solo tenés que iniciar sesión de nuevo con
                  Google — se crea una cuenta nueva desde cero, ya que la anterior no se puede
                  recuperar.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 32px 32px;">
                <div style="height:1px; background-color: rgba(255,255,255,0.09); margin-bottom:16px;"></div>
                <p style="margin:0; font-size:12px; line-height:1.6; color:#6f668f;">
                  Este es un email automático de confirmación, no hace falta que respondas.
                  Si no pediste este borrado, contactanos a la brevedad.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}