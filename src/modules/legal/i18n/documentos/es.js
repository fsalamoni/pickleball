/**
 * Traducción de cortesía (español) de los documentos legales. El texto en
 * portugués de `domain/legalDocuments.js` es la versión vinculante. `fonte` es
 * la huella del texto en portugués del que salió esta traducción
 * (`legalSourceHash`).
 */
import { LEGAL_CONTACT_EMAIL } from '../../domain/legalDocuments.js';

export default {
  'termos-de-uso': {
    fonte: '39661c5e',
    title: 'Términos de Uso',
    eyebrow: 'Documento esencial',
    description: 'Condiciones generales que rigen el uso de la plataforma PickleRush por parte de todos los usuarios.',
    sections: [
      {
        title: 'Naturaleza de la plataforma',
        description: 'Una herramienta tecnológica para la comunidad del pickleball.',
        paragraphs: [
          'PickleRush es una plataforma tecnológica (aplicación web/PWA) que conecta a la comunidad amateur de pickleball en Brasil: atletas, organizadores de torneos, clubes, arenas y entrenadores. La plataforma ofrece herramientas para crear y gestionar torneos, reservas de canchas, clases, clubes, ranking, comunidad y mensajes.',
          'PickleRush es una facilitadora tecnológica. No organiza eventos, no proporciona canchas, no imparte clases, no intermedia pagos y no es parte en las relaciones entre usuarios (por ejemplo, entre un atleta y una arena, o entre un alumno y un entrenador). Los valores mostrados son responsabilidad de quien los registra y sirven solo como referencia.',
        ],
      },
      {
        title: 'Cuenta, elegibilidad y registro',
        paragraphs: [
          'Para usar las funciones que requieren inicio de sesión es necesario crear una cuenta con datos verdaderos, completos y actualizados. Usted es responsable de mantener la confidencialidad de sus credenciales y de toda actividad realizada en su cuenta.',
        ],
        bullets: [
          'Está prohibido crear cuentas con identidad falsa o hacerse pasar por terceros.',
          'Los menores de 18 años solo pueden usar la plataforma con el consentimiento y la supervisión de sus representantes legales (ver el Reconocimiento de Riesgos y Exención de Responsabilidad y la Política de Privacidad).',
          'PickleRush puede suspender o cancelar las cuentas que infrinjan estos Términos.',
        ],
      },
      {
        title: 'Uso aceptable',
        description: 'Lo que se espera de cada usuario.',
        bullets: [
          'Respetar la legislación aplicable, las reglas del deporte (CBP/USAP) y el juego limpio.',
          'No registrar resultados fraudulentos ni manipular el ranking, las inscripciones o la nivelación.',
          'No publicar contenido ilegal, ofensivo, discriminatorio, spam o que viole derechos de terceros.',
          'No intentar eludir la seguridad, hacer ingeniería inversa, recopilar datos de forma automatizada (scraping) ni sobrecargar la plataforma.',
        ],
      },
      {
        title: 'Contenido del usuario y propiedad intelectual',
        paragraphs: [
          'Usted conserva la titularidad del contenido que publica (nombre, fotos, textos, resultados). Al publicarlo, otorga a PickleRush una licencia no exclusiva para alojar y mostrar ese contenido en el funcionamiento normal de la plataforma (por ejemplo, mostrar su nombre en el cuadro de un torneo).',
          'La marca, el diseño, el código y los demás elementos de PickleRush están protegidos y no pueden copiarse ni reutilizarse sin autorización.',
        ],
      },
      {
        title: 'Exenciones y limitación de responsabilidad',
        paragraphs: [
          'La plataforma se ofrece "tal como está". PickleRush no garantiza disponibilidad ininterrumpida y no se responsabiliza por la conducta de los usuarios, por la realización o la calidad de eventos, clases y reservas, ni por perjuicios derivados de relaciones establecidas entre usuarios.',
          'En la máxima medida permitida por la ley, la responsabilidad de PickleRush se limita al funcionamiento de la herramienta tecnológica.',
        ],
      },
      {
        title: 'Modificaciones, cancelación y jurisdicción',
        paragraphs: [
          'Estos Términos pueden actualizarse para reflejar cambios de funcionalidad o requisitos legales. Los cambios relevantes requerirán una nueva aceptación. La versión vigente es siempre la publicada en este centro.',
          'Puede cancelar su cuenta en cualquier momento. Se aplica la legislación brasileña, y se elige la jurisdicción del domicilio del consumidor cuando corresponda.',
        ],
      },
    ],
  },

  privacidade: {
    fonte: '1137e065',
    title: 'Política de Privacidad',
    eyebrow: 'Documento esencial · LGPD',
    description: 'Cómo tratamos, protegemos y compartimos sus datos personales, conforme a la LGPD (Ley General de Protección de Datos de Brasil, Ley 13.709/2018).',
    sections: [
      {
        title: 'Datos que recopilamos',
        bullets: [
          'Registro: nombre, correo electrónico y, cuando se informen, nombre visible, teléfono, ciudad/estado y fecha de nacimiento.',
          'Uso deportivo: inscripciones, resultados, ranking, nivelación, reservas, clases, clubes y mensajes.',
          'Técnicos: identificadores de dispositivo/sesión y registros de auditoría de acciones administrativas.',
          'Fotos y contenido multimedia que usted decida enviar (foto de perfil, imágenes de arena/club).',
        ],
      },
      {
        title: 'Finalidades y bases legales',
        paragraphs: [
          'Tratamos datos para: operar la plataforma y sus funciones (ejecución de contrato); calcular el ranking y organizar eventos (interés legítimo deportivo); cumplir obligaciones legales; y, cuando corresponda, con base en su consentimiento (por ejemplo, comunicaciones opcionales).',
        ],
      },
      {
        title: 'Visibilidad y uso compartido',
        paragraphs: [
          'El nombre, las inscripciones, los resultados y el ranking son visibles para otros participantes del mismo contexto (torneo, club, día de juego). Los datos de contacto (teléfono, correo electrónico) no se muestran públicamente.',
          'Solo compartimos datos con los encargados necesarios para prestar el servicio (por ejemplo, infraestructura en la nube — Google Firebase) y cuando la ley lo exige. No vendemos datos personales.',
        ],
      },
      {
        title: 'Derechos del titular',
        paragraphs: [
          'Conforme a la LGPD, usted puede solicitar la confirmación del tratamiento, el acceso, la corrección, la anonimización, la portabilidad, información sobre el uso compartido y la eliminación de los datos tratados con base en el consentimiento.',
        ],
        bullets: [
          `Solicitudes al correo electrónico del encargado de protección de datos: ${LEGAL_CONTACT_EMAIL}.`,
          'La exportación de sus datos en JSON está disponible en la página de Configuración.',
          'La eliminación de la cuenta borra sus datos personales, salvo los que la ley obliga a conservar.',
        ],
      },
      {
        title: 'Seguridad, conservación y menores',
        paragraphs: [
          'Adoptamos medidas técnicas y organizativas para proteger sus datos (control de acceso mediante reglas de seguridad y auditoría). Conservamos los datos durante el tiempo necesario para sus finalidades u obligaciones legales.',
          'Los datos de menores se tratan en el interés superior del menor y requieren el consentimiento del representante legal.',
        ],
      },
      {
        title: 'Modificaciones',
        paragraphs: [
          'Esta política puede actualizarse. Los cambios relevantes requerirán una nueva aceptación, y la versión vigente estará siempre publicada en este centro.',
        ],
      },
    ],
  },

  'riscos-e-responsabilidade': {
    fonte: '20f947f5',
    title: 'Reconocimiento de Riesgos y Exención de Responsabilidad',
    eyebrow: 'Documento esencial',
    description: 'Conocimiento de los riesgos propios de la práctica deportiva y de la participación en eventos, reservas y clases organizados por terceros.',
    sections: [
      {
        title: 'Riesgos de la actividad física',
        paragraphs: [
          'El pickleball es una actividad física que implica riesgos inherentes, como caídas, lesiones musculares y articulares, contacto e imprevistos. Al participar en partidos, días de juego, torneos, clases y reservas, usted declara conocer estos riesgos y estar apto para la práctica.',
        ],
        bullets: [
          'Se recomienda una evaluación médica antes de comenzar o intensificar la práctica deportiva.',
          'Usted es responsable de respetar sus límites, calentar y usar el equipo adecuado.',
        ],
      },
      {
        title: 'Responsabilidad por la organización y los lugares',
        paragraphs: [
          'Los eventos, clases y reservas son organizados y conducidos por usuarios (organizadores, arenas, entrenadores, clubes), no por PickleRush. La seguridad del lugar, la supervisión, los primeros auxilios y el cumplimiento de las normas son responsabilidad de quien organiza y/u opera el espacio.',
        ],
      },
      {
        title: 'Exención de responsabilidad de la plataforma',
        paragraphs: [
          'En la máxima medida permitida por la ley, usted exime a PickleRush de responsabilidad por daños personales o materiales derivados de la práctica deportiva o de eventos, clases o reservas contratados a través de la plataforma. PickleRush ofrece la herramienta tecnológica, no la actividad en sí.',
        ],
      },
      {
        title: 'Menores y representantes',
        paragraphs: [
          'Cuando el participante sea menor de edad, el representante legal declara conocer estos riesgos y asume la responsabilidad por la participación del menor, autorizándola en los términos de este documento.',
        ],
      },
    ],
  },

  'politica-de-uso': {
    fonte: 'f2464c4b',
    title: 'Política de Uso',
    eyebrow: 'Complementario',
    description: 'Condiciones generales de uso de la plataforma: naturaleza deportiva de la herramienta, conducta esperada y uso aceptable.',
    sections: [
      {
        title: 'Naturaleza de la plataforma',
        description: 'Herramienta deportiva para la comunidad amateur de pickleball.',
        paragraphs: [
          'PickleRush es una herramienta tecnológica para la comunidad amateur de pickleball en Brasil: creación y gestión de torneos, reservas de canchas, clases, clubes, ranking, comunidad y mensajes. Los organizadores crean torneos, definen reglas, abren inscripciones, sortean cuadros, registran resultados y calculan rankings.',
          'La plataforma no organiza eventos, no proporciona canchas, no administra premios ni intermedia pagos. Los valores mostrados (por ejemplo, una cuota de inscripción) sirven solo como referencia; el cobro y el control financiero son responsabilidad de quien los registra.',
        ],
      },
      {
        title: 'Conducta y responsabilidad',
        description: 'Cada usuario responde por sus propios actos.',
        paragraphs: [
          'El uso debe respetar la legislación aplicable, las reglas del deporte (CBP/USAP) y los principios del juego limpio. El fraude en el registro de resultados, la identidad falsa o las ofensas a otros usuarios pueden llevar a la suspensión de la cuenta y del torneo.',
        ],
      },
      {
        title: 'Uso aceptable',
        bullets: [
          'Proporcionar datos verdaderos y mantener la cuenta segura.',
          'No manipular el ranking, las inscripciones, la nivelación ni los resultados.',
          'No publicar contenido ilegal, ofensivo, discriminatorio ni spam.',
          'No intentar eludir la seguridad, hacer ingeniería inversa ni recopilar datos de forma automatizada (scraping).',
        ],
      },
      {
        title: 'Privacidad y datos',
        paragraphs: [
          'El tratamiento de datos personales sigue la Política de Privacidad, disponible en este centro. Los nombres, las inscripciones, los resultados y el ranking son visibles para otros participantes del mismo contexto; los datos de contacto (teléfono, correo electrónico) no se muestran públicamente.',
        ],
      },
      {
        title: 'Modificaciones',
        paragraphs: [
          'Esta política puede actualizarse para reflejar cambios de funcionalidad, requisitos legales o de seguridad. La versión vigente será siempre la publicada en este centro.',
        ],
      },
    ],
  },

  cookies: {
    fonte: '7874b71f',
    title: 'Política de Cookies',
    eyebrow: 'Complementario',
    description: 'Cómo usamos cookies y tecnologías similares para operar y mejorar la plataforma.',
    sections: [
      {
        title: 'Lo que usamos',
        bullets: [
          'Cookies/almacenamiento esenciales: sesión de inicio, preferencias (tema, navegación) y seguridad.',
          'Almacenamiento local (localStorage): estado de la interfaz y funciones de la PWA (uso sin conexión/instalación).',
          'No utilizamos cookies publicitarias de terceros.',
        ],
      },
      {
        title: 'Gestión',
        paragraphs: [
          'Puede borrar o bloquear las cookies/el almacenamiento en la configuración de su navegador. Algunas funciones esenciales pueden dejar de funcionar correctamente sin ellos.',
        ],
      },
    ],
  },

  'diretrizes-comunidade': {
    fonte: '99fdd797',
    title: 'Normas de la Comunidad',
    eyebrow: 'Complementario',
    description: 'Reglas de convivencia para el feed, foros, chat, clubes y demás espacios sociales de la plataforma.',
    sections: [
      {
        title: 'El respeto es la regla',
        paragraphs: [
          'Los espacios sociales (comunidad, foros de club, chat, reseñas) existen para sumar. Trate a todos con respeto, dentro y fuera de la cancha.',
        ],
      },
      {
        title: 'Conductas prohibidas',
        bullets: [
          'Discursos de odio, discriminación, acoso, amenazas o bullying.',
          'Contenido sexual, violento, ilegal o que exponga a terceros sin su consentimiento.',
          'Spam, estafas, cadenas y publicidad no autorizada.',
          'Desinformación sobre resultados, ranking o identidad de atletas.',
        ],
      },
      {
        title: 'Moderación y denuncias',
        paragraphs: [
          'Los contenidos y las cuentas que infrinjan estas normas pueden ser eliminados o suspendidos. Las reseñas de arenas y los contenidos de clubes cuentan con moderación. Las denuncias pueden enviarse por los canales disponibles en la plataforma o al soporte.',
        ],
      },
    ],
  },

  'pagamentos-reembolsos': {
    fonte: 'd93a50db',
    title: 'Política de Pagos y Reembolsos',
    eyebrow: 'Complementario',
    description: 'Cómo funcionan los valores mostrados, los pagos entre usuarios y los reembolsos.',
    sections: [
      {
        title: 'La plataforma no procesa pagos',
        paragraphs: [
          'Actualmente PickleRush no intermedia ni procesa pagos. Los valores de inscripción, reserva, clase, mensualidad y productos los define y cobra directamente el organizador, la arena, el entrenador o el club responsable — por ejemplo, mediante una clave PIX (el sistema de pagos instantáneos de Brasil) informada por ellos.',
          'Las instrucciones de pago (como una clave PIX) mostradas en la plataforma las proporcionan esos responsables. Verifique siempre los datos antes de pagar.',
        ],
      },
      {
        title: 'Confirmación y comprobantes',
        paragraphs: [
          'La confirmación del pago la hace manualmente el responsable (por ejemplo, el administrador del torneo marca la inscripción como pagada). Guarde sus comprobantes. PickleRush solo registra el estado informado por los responsables.',
        ],
      },
      {
        title: 'Reembolsos',
        paragraphs: [
          'Las solicitudes de reembolso deben tratarse directamente con quien recibió el pago (organizador, arena, entrenador o club), conforme a la política de cancelación aplicable. PickleRush no retiene valores y, por lo tanto, no realiza reembolsos.',
        ],
      },
    ],
  },

  cancelamento: {
    fonte: '5a503ae3',
    title: 'Política de Cancelación',
    eyebrow: 'Complementario',
    description: 'Reglas generales de cancelación de inscripciones, reservas y clases.',
    sections: [
      {
        title: 'Las cancelaciones dependen de cada responsable',
        paragraphs: [
          'Cada arena, organizador, entrenador y club puede definir sus propias reglas y plazos de cancelación. Cuando haya una política de cancelación configurada (por ejemplo, una antelación mínima para una reserva), la plataforma informa y aplica ese plazo.',
        ],
      },
      {
        title: 'Cancelaciones tardías y no presentación',
        bullets: [
          'Las cancelaciones fuera de plazo pueden marcarse como tardías.',
          'La ausencia sin aviso (no-show) puede ser registrada por la arena.',
          'Los eventuales cargos o penalidades son responsabilidad del respectivo prestador, no de PickleRush.',
        ],
      },
    ],
  },

  'termos-mercado': {
    fonte: 'ffb54f38',
    title: 'Términos Generales del Mercado',
    eyebrow: 'Mercado · Términos generales',
    description: 'Qué es el Mercado PickleRush, qué no es, y las reglas que valen para quien compra y para quien vende.',
    sections: [
      {
        title: '1. Qué es el Mercado',
        description: 'Un espacio de anuncios que acerca a quien quiere vender con quien quiere comprar.',
        paragraphs: [
          'El Mercado es el área de PickleRush en la que atletas, entrenadores, arenas y tiendas publican anuncios de productos relacionados con el pickleball. PickleRush actúa solo como proveedora de aplicaciones de internet conforme a la Ley n.º 12.965/2014, el Marco Civil da Internet (Marco Civil de Internet de Brasil): ofrece el espacio para el anuncio y herramientas para que las personas interesadas se encuentren y conversen.',
          'Estos Términos Generales valen para todas las personas que usan el Mercado. Se complementan con los Términos del Comprador, los Términos del Vendedor y la Política de Imágenes, Videos y Contenido Generado por IA, y se suman a los Términos de Uso, la Política de Privacidad y las Normas de la Comunidad de la plataforma. En caso de conflicto, las reglas específicas del Mercado prevalecen en lo que se refiere al Mercado.',
        ],
      },
      {
        title: '2. Lo que PickleRush no es y no hace',
        description: 'PickleRush no participa en el negocio realizado entre las partes.',
        bullets: [
          'No es vendedora, proveedora, fabricante, importadora, distribuidora ni propietaria de los productos anunciados.',
          'No es parte del contrato de compraventa ni es intermediaria de pagos, corredora, mandataria, representante, depositaria o garante de ninguna de las partes.',
          'No recibe, guarda, retiene ni transfiere valores: el pago va directamente del comprador al vendedor, por el medio que ellos usen.',
          'No cobra comisión sobre las ventas y no define precio, envío, plazo, forma de entrega, garantía ni ninguna condición del negocio.',
          'No almacena, inspecciona, prueba, embala, transporta ni entrega productos, y no contrata ni recomienda transportistas.',
          'No emite factura, recibo ni certificado de garantía en nombre de nadie, y no recauda los tributos que deban las partes.',
          'No verifica ni garantiza la existencia, la propiedad, el origen, la autenticidad, la calidad, la seguridad, la legalidad o el estado de los productos, ni la veracidad de los anuncios, las fotos y los videos, ni la identidad, la capacidad o la solvencia de quien compra y de quien vende.',
        ],
      },
      {
        title: '3. El negocio es entre comprador y vendedor',
        paragraphs: [
          'La compraventa realizada a partir de un anuncio es un contrato celebrado directa y exclusivamente entre comprador y vendedor (Código Civil brasileño, arts. 481 y siguientes). Les corresponden a ellos, y solo a ellos, la decisión de negociar, las condiciones acordadas, el pago, la entrega, el cambio, la devolución y la garantía, así como los derechos y deberes que nacen del negocio.',
          'Cuando el vendedor sea proveedor (tienda, arena o quien vende con habitualidad), la relación con el comprador es de consumo y el vendedor responde ante él conforme al CDC (Código de Defensa del Consumidor de Brasil). Entre particulares, valen lo acordado y el Código Civil, incluidas las reglas sobre vicios ocultos (arts. 441 a 446).',
        ],
      },
      {
        title: '4. Las herramientas del Mercado',
        bullets: [
          'El pedido, la oferta, el carrito, los mensajes, las preguntas, las reseñas, los cupones, los avisos y el registro de problemas en el pedido son herramientas de organización y de comunicación entre las partes.',
          'Los estados del pedido ("aceptado", "pagado", "enviado", "recibido") los informan las propias partes. No son recibo, comprobante de pago, prueba de entrega ni garantía otorgada por PickleRush.',
          'El registro de problemas permite que las partes dejen por escrito lo que ocurrió y que PickleRush evalúe medidas sobre anuncios y cuentas. No es arbitraje ni mediación, no obliga a las partes, no sustituye la atención del propio vendedor y no impide que cualquier persona acuda al Procon (organismo de defensa del consumidor), a consumidor.gov.br o al Poder Judicial.',
          'Usar las herramientas no convierte a PickleRush en participante del negocio ni crea para ella ninguna obligación de garantizar el resultado de la compra.',
        ],
      },
      {
        title: '5. Lo que PickleRush hace',
        bullets: [
          'Mantiene el Mercado en funcionamiento con un cuidado razonable, sin prometer que estará siempre disponible o libre de fallas.',
          'Trata los datos personales conforme a la LGPD (Ley General de Protección de Datos de Brasil, Ley n.º 13.709/2018) y la Política de Privacidad, mostrando los datos de contacto y de entrega solo a quien los necesita para concluir el pedido.',
          'Puede rechazar, pausar o retirar anuncios, y advertir, suspender o cancelar cuentas que incumplan estos documentos o la ley, por decisión propia o a partir de una denuncia, sin el deber de supervisar previamente lo que se publica.',
          'Cumple las órdenes de las autoridades y de la Justicia y colabora con ellas en la forma de la ley.',
        ],
      },
      {
        title: '6. Límites de responsabilidad',
        paragraphs: [
          'En la máxima medida permitida por la ley, PickleRush no responde por pérdidas y daños derivados del negocio entre las partes, como: producto no entregado, entregado con retraso, extraviado o dañado en el transporte; producto distinto del anuncio, defectuoso, falsificado o de origen ilícito; pago realizado y no reconocido, o hecho a la persona equivocada; estafas y fraudes cometidos por usuarios o por terceros, sobre todo fuera de la plataforma; desistimiento, incumplimiento o conducta de cualquiera de las partes; y encuentros presenciales acordados entre ellas.',
          'Nada en estos documentos excluye derechos que la ley garantiza y que no pueden renunciarse. PickleRush responde, conforme a la ley, por sus propios actos y por el funcionamiento de la herramienta que ofrece.',
        ],
      },
      {
        title: '7. Seguridad y prevención de estafas',
        bullets: [
          'Acuerde y registre todo por el pedido y los mensajes del Mercado. Desconfíe de quien le pida negociar o pagar por fuera.',
          'Antes de pagar, verifique que el nombre de quien recibe el Pix (el sistema de pagos instantáneos de Brasil) sea el mismo del vendedor que aparece en el pedido.',
          'Nunca envíe contraseñas, códigos de verificación ni fotos de documentos. PickleRush nunca pide esos datos.',
          'En los encuentros para retirar productos, prefiera lugares públicos y concurridos, de día, y revise el producto antes de concluir.',
          'Si es víctima de una estafa con Pix, contacte de inmediato a su banco (existe un mecanismo de devolución del Banco Central para casos de fraude) y presente una denuncia policial. Denuncie el anuncio o la cuenta en PickleRush.',
        ],
      },
      {
        title: '8. Indemnización, ley aplicable y modificaciones',
        paragraphs: [
          'Quien incumpla estos documentos o la ley responde por los daños que cause y, si PickleRush es reclamada o demandada por un acto suyo, debe indemnizarla, incluidos los gastos razonables de defensa.',
          `Estos documentos se rigen por la ley brasileña. Cuando haya relación de consumo, la acción puede interponerse en la jurisdicción del domicilio del consumidor. PickleRush puede actualizar estos documentos; los cambios relevantes reciben una nueva versión y requieren una nueva aceptación antes de usar el Mercado. Dudas: ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },

  'termos-comprador-mercado': {
    fonte: '938d343a',
    title: 'Términos del Comprador',
    eyebrow: 'Mercado · Quien compra',
    description: 'La responsabilidad de quien compra en el Mercado PickleRush.',
    sections: [
      {
        title: '1. Usted decide y responde por su compra',
        paragraphs: [
          'Al comprar en el Mercado, usted reconoce que PickleRush solo facilita el encuentro de intereses entre usted y el vendedor, que no presta ningún servicio en el negocio y que no vende, no entrega, no recibe el pago ni garantiza el producto.',
          'La decisión de comprar es suya. Usted asume la responsabilidad de evaluar qué está comprando y a quién: leer el anuncio completo, ver todas las fotos y videos (incluida la etiqueta "Generado por IA", cuando exista), preguntar lo necesario antes de hacer el pedido, revisar las reseñas y la página del vendedor, la forma de entrega, el envío, el plazo y la política de cambios y devoluciones, y verificar la compatibilidad, la talla y la autenticidad cuando importen.',
        ],
      },
      {
        title: '2. Exención de PickleRush',
        paragraphs: [
          'En la máxima medida permitida por la ley, usted exime a PickleRush de responsabilidad por el producto y por el negocio, incluidos defectos, vicios, diferencias respecto del anuncio, falsificación, retraso, extravío, daños en el transporte, falta de entrega y desistimiento del vendedor. Los reclamos sobre el producto, la entrega, el cambio, la devolución, el reembolso o la garantía deben hacerse al vendedor.',
          'Sus derechos legales siguen vigentes frente al vendedor. Si este es proveedor, usted tiene las garantías del CDC (Código de Defensa del Consumidor de Brasil), incluido el derecho de arrepentirse dentro de los 7 días siguientes a la recepción en las compras hechas por internet (art. 49) y la garantía contra vicios (arts. 18 y 26). Entre particulares, valen lo acordado y el Código Civil.',
        ],
      },
      {
        title: '3. Pago',
        bullets: [
          'El pago se hace directamente al vendedor (por lo general por Pix, el sistema de pagos instantáneos de Brasil), y la clave aparece después de que él acepta el pedido.',
          'Verifique el nombre de quien recibe antes de pagar. Pague solo el valor y a la clave que aparecen en el pedido.',
          'Como PickleRush no recibe el dinero, no revierte, no reembolsa, no bloquea ni devuelve valores. La devolución siempre se gestiona con el vendedor; en caso de fraude con Pix, contacte a su banco.',
          'Avise en el pedido cuando pague y guarde el comprobante.',
        ],
      },
      {
        title: '4. Recepción y retiro',
        bullets: [
          'Informe una dirección correcta y completa cuando haya envío. Una dirección incorrecta o la ausencia en la entrega son asuntos a resolver con el vendedor y la transportista.',
          'Revise el producto al recibirlo; si hay algún problema, regístrelo con fotos y avise al vendedor por el pedido lo antes posible, dentro del plazo indicado en él.',
          'Confirme la recepción solo cuando realmente la haya recibido. La confirmación concluye el pedido.',
          'Los encuentros para retirar el producto se acuerdan entre usted y el vendedor, por cuenta y riesgo de ambos.',
        ],
      },
      {
        title: '5. Conducta de quien compra',
        bullets: [
          'Haga pedidos y ofertas solo cuando tenga intención real de comprar, y pague dentro del plazo acordado.',
          'Use los datos del vendedor (nombre, clave Pix, lugar de retiro) solo para esta compra.',
          'Evalúe con honestidad y solo sobre la compra. Las reseñas falsas, las amenazas o el chantaje con reseñas llevan a la suspensión.',
          'Los menores de 18 años solo compran con autorización y acompañamiento de su representante legal.',
        ],
      },
    ],
  },

  'termos-vendedor-mercado': {
    fonte: '98f4e5d4',
    title: 'Términos del Vendedor',
    eyebrow: 'Mercado · Quien vende',
    description: 'El vendedor responde, de forma única y exclusiva, por el producto, la venta, el transporte y los documentos.',
    sections: [
      {
        title: '1. Responsabilidad única y exclusiva del vendedor',
        description: 'PickleRush no participa en la venta; quien vende responde por ella.',
        bullets: [
          'El producto: su existencia, propiedad o derecho a vender, origen lícito, autenticidad, calidad, estado, seguridad y conformidad con las normas que le son aplicables (como las certificaciones exigidas por la ley).',
          'El anuncio: título, descripción, características, estado de uso, defectos, precio, envío, plazos y las fotos y videos. El anuncio obliga a quien lo publica (CDC — Código de Defensa del Consumidor de Brasil, arts. 30, 31 y 37).',
          'La venta: aceptar o rechazar pedidos y ofertas, cumplir lo acordado, recibir el pago y verificar que realmente haya ingresado en su cuenta.',
          'El cambio, la devolución, el reembolso, la garantía y la atención al comprador, incluido el derecho de arrepentimiento cuando usted sea proveedor.',
          'Los tributos, licencias y obligaciones fiscales y regulatorias de su actividad.',
        ],
      },
      {
        title: '2. Transporte y entrega',
        bullets: [
          'La forma de entrega (envío, retiro o encuentro) la ofrece y la cumple usted. Si hay envío, la elección, la contratación y el pago de la transportista o del correo (Correios), el embalaje, el seguro, el código de seguimiento y el plazo son de su única y exclusiva responsabilidad.',
          'El riesgo del producto es suyo hasta la entrega al comprador, salvo lo que acuerden por escrito y la ley permita (Código Civil, art. 492).',
          'Respete las restricciones de transporte de cada producto (por ejemplo, baterías y artículos peligrosos).',
          'PickleRush no recomienda, no contrata, no paga ni responde por transportistas, ni por extravíos, daños o retrasos.',
        ],
      },
      {
        title: '3. Documentos del negocio',
        bullets: [
          'La factura (nota fiscal), el recibo, el certificado de garantía, el manual y los demás documentos exigidos por la ley los emite y entrega usted, cuando correspondan.',
          'Las tiendas, arenas y quienes venden con habitualidad deben informar con claridad su nombre o razón social, CPF o CNPJ (número de identificación fiscal brasileño de personas o empresas), dirección y medios de contacto, las características esenciales del producto, el precio total con el envío y las condiciones de la oferta, como exige el Decreto n.º 7.962/2013 (comercio electrónico).',
          'Las condiciones de cambio y devolución deben estar escritas en su página y respetar la ley.',
        ],
      },
      {
        title: '4. Lo que no se puede vender',
        bullets: [
          'Productos falsificados, réplicas o que imiten marcas de terceros.',
          'Productos robados, hurtados, de contrabando o cuyo origen usted no pueda comprobar.',
          'Productos ilegales, peligrosos, retirados del mercado (recall) o cuya venta dependa de una autorización que usted no tiene.',
          'Cualquier cosa que no pertenezca al universo del deporte, además de lo que prohíben las Normas de la Comunidad y la ley.',
        ],
      },
      {
        title: '5. Datos del comprador',
        paragraphs: [
          'El nombre, la dirección y el teléfono del comprador le aparecen solo después de la aceptación, y solo pueden usarse para concluir esa venta. Respecto de esos datos, usted es responsable independiente del tratamiento conforme a la LGPD (Ley General de Protección de Datos de Brasil): debe guardarlos de forma segura, no compartirlos ni usarlos para publicidad sin consentimiento, y eliminarlos cuando ya no sean necesarios.',
        ],
      },
      {
        title: '6. Exención e indemnización',
        paragraphs: [
          'Usted exime a PickleRush de responsabilidad por reclamos, cobros, multas, sanciones y acciones relacionados con sus productos, anuncios, ventas, entregas y documentos, y se compromete a indemnizarla, incluidos los gastos razonables de defensa, en caso de que sea reclamada o condenada por un hecho suyo.',
          'Incumplir estos Términos puede llevar a la retirada de anuncios y a la suspensión o cancelación de las ventas y de la cuenta, sin perjuicio de las medidas legales.',
        ],
      },
    ],
  },

  'politica-imagens-ia-mercado': {
    fonte: 'c9b42e49',
    title: 'Política de Imágenes, Videos y Contenido Generado por IA',
    eyebrow: 'Mercado · Fotos y videos',
    description: 'Cómo deben ser las fotos y los videos de los anuncios, y cuándo indicar que fueron generados o alterados por inteligencia artificial.',
    sections: [
      {
        title: '1. Las fotos y los videos muestran el producto real',
        bullets: [
          'Use fotos y videos del propio producto que se entregará, mostrando su estado, las marcas de uso y los defectos.',
          'Las imágenes de catálogo o del fabricante solo pueden usarse para un producto nuevo idéntico al anunciado, y la descripción debe indicar que la imagen es ilustrativa.',
          'Se permite ajustar la luz, el contraste, el encuadre, el tamaño y la rotación, siempre que el producto se siga viendo como realmente es.',
        ],
      },
      {
        title: '2. Cuándo marcar "Generada o alterada por IA"',
        paragraphs: [
          'Marque la opción en la foto o el video siempre que haya sido creado por inteligencia artificial o alterado por ella de un modo que cambie lo que ve el comprador: el producto armado o "renderizado", colores, forma, tamaño o accesorios distintos, defectos borrados, o el producto colocado en un escenario creado por IA. La plataforma muestra la etiqueta "Generado por IA" sobre la imagen, en las tarjetas y en la foto ampliada.',
          'No es necesario marcar ajustes simples que no cambian el producto, como recorte, luz, contraste, nitidez o un fondo liso en lugar del original sin alterar el producto en sí.',
        ],
      },
      {
        title: '3. La declaración es suya',
        bullets: [
          'Quien publica declara si la imagen o el video fue generado o alterado por IA y responde, de forma única y exclusiva, por la veracidad de esa información y por el contenido publicado.',
          'PickleRush no analiza ni certifica automáticamente las imágenes. La presencia o la ausencia de la etiqueta no es una garantía otorgada por la plataforma.',
          'Una imagen generada por IA no puede usarse para engañar al comprador sobre el producto. La publicidad engañosa está prohibida por el CDC (Código de Defensa del Consumidor de Brasil, art. 37).',
        ],
      },
      {
        title: '4. Lo que no se puede publicar',
        bullets: [
          'Imágenes o videos sobre los que usted no tiene derechos (Ley n.º 9.610/1998, de derechos de autor), como fotos de otros vendedores o de sitios web sin autorización.',
          'La imagen de una persona sin su autorización (Código Civil, art. 20), y la de un niño, niña o adolescente identificable sin la autorización de su representante.',
          'Montajes que imiten a personas reales (deepfake), marcas de terceros en productos que no son de esa marca, y contenido sexual, violento o discriminatorio.',
          'Datos personales visibles, como documentos, matrículas de vehículos, direcciones y teléfonos.',
        ],
      },
      {
        title: '5. Medidas y denuncias',
        paragraphs: [
          'Los anuncios con imágenes engañosas, sin la etiqueta cuando correspondía o que incumplan esta política pueden pausarse o retirarse, y la cuenta puede ser suspendida. Cualquier persona puede denunciar un anuncio con el botón de denuncia.',
          'Todavía no existe en Brasil una ley vigente que regule el etiquetado del contenido generado por IA; esta política adopta la transparencia como buena práctica y se actualizará cuando cambie la legislación.',
        ],
      },
    ],
  },

  'termos-organizador': {
    fonte: 'fea3bd23',
    title: 'Términos del Organizador de Torneos',
    eyebrow: 'Por rol · Organizador',
    description: 'Responsabilidades de quien crea y administra torneos en la plataforma.',
    sections: [
      {
        title: 'Responsabilidad por el evento',
        paragraphs: [
          'Al crear un torneo, usted es responsable de su organización, reglas, comunicación con los inscritos, arbitraje, premios y realización. PickleRush solo proporciona las herramientas de gestión.',
        ],
      },
      {
        title: 'Inscripciones, valores y datos de los inscritos',
        bullets: [
          'Los valores de inscripción los define y cobra usted; la plataforma no intermedia pagos.',
          'Usted accede a los datos de los inscritos solo para gestionar su evento y debe tratarlos conforme a la LGPD (Ley General de Protección de Datos de Brasil).',
          'Está prohibido usar los datos de los inscritos para fines ajenos al torneo.',
        ],
      },
      {
        title: 'Integridad y conducta',
        paragraphs: [
          'Usted se compromete a registrar resultados verdaderos, tratar a los participantes con igualdad y cumplir la legislación y las reglas del deporte. Los fraudes o abusos pueden llevar a la suspensión del torneo y de la cuenta.',
        ],
      },
    ],
  },

  'termos-arena': {
    fonte: 'fac5b370',
    title: 'Términos del Propietario de Arena',
    eyebrow: 'Por rol · Arena',
    description: 'Responsabilidades de quien registra y gestiona arenas, canchas, reservas y tienda.',
    sections: [
      {
        title: 'Veracidad y operación del espacio',
        paragraphs: [
          'Usted declara tener legitimidad para registrar y operar la arena y sus canchas, y que la información (dirección, precios, horarios, fotos, reglas) es verdadera y está actualizada. La operación física, la seguridad y el mantenimiento del espacio son su responsabilidad.',
        ],
      },
      {
        title: 'Reservas, precios y cancelaciones',
        bullets: [
          'Usted define los precios, la disponibilidad y la política de cancelación de sus canchas.',
          'La confirmación de reservas y pagos la hace usted; la plataforma no procesa pagos.',
          'Debe cumplir las reservas confirmadas y comunicar los cambios con una antelación razonable.',
        ],
      },
      {
        title: 'Clientes, datos y cumplimiento',
        paragraphs: [
          'Los datos de clientes a los que se acceda para gestionar reservas, mensualidades y la tienda deben tratarse conforme a la LGPD (Ley General de Protección de Datos de Brasil) y usarse solo para esa finalidad. Usted es responsable del cumplimiento fiscal y legal de su operación.',
        ],
      },
    ],
  },

  'termos-professor': {
    fonte: '713aef07',
    title: 'Términos del Entrenador',
    eyebrow: 'Por rol · Entrenador',
    description: 'Responsabilidades de quien ofrece clases, paquetes y clínicas en la plataforma.',
    sections: [
      {
        title: 'Impartición de las clases',
        paragraphs: [
          'Al registrarse como entrenador, usted declara tener la calificación y la legitimidad para ofrecer clases de pickleball. La relación de enseñanza se establece directamente entre usted y el alumno; PickleRush solo facilita el encuentro y la agenda.',
        ],
      },
      {
        title: 'Valores, paquetes y cancelaciones',
        bullets: [
          'Los precios, paquetes, créditos y la política de cancelación de las clases los define usted.',
          'Los cobros y reembolsos se tratan directamente con el alumno; la plataforma no intermedia pagos.',
        ],
      },
      {
        title: 'Datos de los alumnos y conducta',
        paragraphs: [
          'Las fichas y notas de evolución de los alumnos deben tratarse con confidencialidad y conforme a la LGPD (Ley General de Protección de Datos de Brasil), y usarse solo para el seguimiento pedagógico. Las clases con menores requieren el consentimiento de sus representantes. Usted se compromete a actuar de forma ética y segura.',
        ],
      },
    ],
  },

  'termos-federacao': {
    fonte: '3f59d424',
    title: 'Términos para Federaciones',
    eyebrow: 'Federaciones · Quien administra',
    description: 'Qué ofrece PickleRush a una federación, a qué se compromete la federación con sus afiliados y sus datos, y qué no es la plataforma.',
    sections: [
      {
        title: '1. Qué es la gestión de federación en PickleRush',
        description: 'Una herramienta para la entidad; la entidad sigue siendo quien es.',
        paragraphs: [
          'PickleRush ofrece a la federación un área de gestión: página pública, planes de afiliación, solicitudes de afiliación, cobro por Pix, carnet digital con verificación pública, equipo con roles y, a medida que se liberen, torneos avalados, ranking oficial y módulos adicionales.',
          'La federación es una persona jurídica propia, con CNPJ, estatuto y dirigentes. PickleRush no es la federación, no la representa, no la reconoce como entidad oficial del deporte y no responde por sus actos. Los sellos "Verificada" y "Oficial" solo indican que la plataforma comprobó los datos informados o que la entidad es la reconocida en su ámbito, según la información disponible en esa fecha.',
        ],
      },
      {
        title: '2. Quién solicita la apertura y quién responde',
        bullets: [
          'Quien solicita la apertura declara tener poderes para representar a la entidad e informa un CNPJ y una razón social verdaderos. Aprobada, esa persona pasa a ser presidente en la plataforma y puede nombrar al equipo.',
          'Los actos del equipo en la plataforma (aprobar una afiliación, confirmar un pago, suspender a un afiliado, publicar información) son actos de la federación, y ella responde por ellos ante los afiliados y la ley.',
          'PickleRush puede rechazar, suspender o cerrar el área de una federación que informe datos falsos, cobre sin prestar lo que promete, incumpla la ley o estos Términos, indicando el motivo.',
        ],
      },
      {
        title: '3. Mensualidades, anualidades y Pix',
        bullets: [
          'Los valores de los planes los define la federación. El pago se hace por Pix directamente a la clave informada por la federación; PickleRush no recibe, no guarda, no transfiere ni intermedia el dinero, y no cobra comisión sobre él.',
          'La federación comprueba la recepción y la confirma en la plataforma. Confirmar activa la afiliación y emite el carnet; la confirmación es responsabilidad de la federación, y un pago confirmado sin haber entrado es un asunto entre la federación y el afiliado.',
          'Recibo, factura, impuestos y el destino de lo recaudado son de la federación. PickleRush solo registra el historial para ambas partes.',
        ],
      },
      {
        title: '4. Datos de los afiliados',
        paragraphs: [
          'Al recibir una solicitud de afiliación, la federación pasa a ver el nombre, la foto, la categoría y los datos que el propio afiliado informó. Respecto a esos datos, la federación es controladora independiente ante la Ley General de Protección de Datos de Brasil (LGPD): solo puede usarlos para la finalidad de la afiliación (registro, cobro, carnet, competiciones y comunicados de la entidad), debe guardarlos con seguridad y no puede venderlos, compartirlos con terceros fuera de esa finalidad ni usarlos para publicidad sin consentimiento.',
          'El carnet digital muestra al público solo lo que la verificación pública libera: nombre, foto (si el afiliado lo permite), federación, tipo de vínculo, número y validez. La federación no debe exponer otros datos del afiliado en páginas, listas o materiales públicos.',
        ],
      },
      {
        title: '5. Exención y responsabilidad',
        paragraphs: [
          'La federación exime a PickleRush de responsabilidad por reclamaciones, cobros, multas y acciones relacionadas con sus afiliaciones, cobros, decisiones deportivas y disciplinarias, comunicados y el uso que haga de los datos de los afiliados, y se compromete a indemnizarla, incluidos los gastos razonables de defensa, en caso de que sea demandada o condenada por un hecho de la federación.',
          'PickleRush puede modificar estos Términos avisando con antelación razonable; la versión vigente es la publicada en el Centro legal. Incumplirlos puede llevar a la suspensión del área de la federación, sin perjuicio de las medidas legales.',
        ],
      },
    ],
  },

  'termos-filiacao': {
    fonte: '392c0ffc',
    title: 'Términos de Afiliación',
    eyebrow: 'Federaciones · Quien se afilia',
    description: 'Qué ocurre cuando solicitas la afiliación a una federación por PickleRush: qué pasa a ver la federación, cómo se paga, qué vale el carnet y cómo salir.',
    sections: [
      {
        title: '1. Con quién te estás afiliando',
        paragraphs: [
          'La afiliación es un vínculo entre tú y la federación, una entidad propia, con CNPJ y dirigentes, que no es PickleRush. La plataforma solo organiza la solicitud, el cobro, el carnet y el historial. Las reglas de la federación (estatuto, reglamentos, decisiones deportivas y disciplinarias) son suyas, y las dudas sobre ellas las responde la federación, por el contacto que aparece en su página.',
        ],
      },
      {
        title: '2. Qué pasa a ver la federación',
        bullets: [
          'Al solicitar la afiliación, el equipo de la federación ve tu nombre, la foto, la categoría en la que juegas, el plan elegido y lo que escribas en la solicitud. El correo, el teléfono, la fecha de nacimiento y la dirección de tu cuenta NO se envían con esta solicitud; si la federación los necesita, te los pide directamente.',
          'La federación es responsable, ante la LGPD, del uso que haga de los datos que recibe. Puedes cancelar la afiliación en cualquier momento en esta plataforma; eso termina el vínculo aquí, pero no borra lo que la federación ya guardó fuera de ella.',
        ],
      },
      {
        title: '3. Pago por Pix',
        bullets: [
          'El valor es el del plan que elegiste, con los descuentos que la federación defina (por edad, por ejemplo). El pago se hace por Pix directamente a la cuenta de la federación. PickleRush no recibe el dinero, no cobra tarifa y no devuelve importes: la devolución y el reembolso se tratan con la federación.',
          'Después de pagar, lo informas en la plataforma ("Ya pagué") y la federación confirma. La afiliación solo queda activa, y el carnet solo vale, después de esa confirmación. Guarda el comprobante.',
          'La mensualidad y la anualidad tienen validez. Cerca del vencimiento la plataforma avisa; vencida, la afiliación queda como "vencida" hasta la renovación, y el carnet deja de verificarse como al día.',
        ],
      },
      {
        title: '4. El carnet digital',
        bullets: [
          'El carnet muestra nombre, foto (si lo permites), federación, tipo de vínculo, número y validez, y un código con QR. Cualquier persona con el código puede verificar, sin cuenta, si la afiliación está al día — y ve solo esos datos.',
          'El carnet lo emite la federación; PickleRush solo lo muestra y lo verifica. No es un documento de identidad y vale lo que la federación y las entidades que lo reconocen decidan.',
          'Tú eliges si la foto aparece en la verificación pública, si la afiliación aparece en tu perfil público y si entras en el directorio de afiliados de la federación. Esas decisiones son tuyas y pueden cambiarse en cualquier momento.',
        ],
      },
      {
        title: '5. Rechazo, suspensión y cancelación',
        paragraphs: [
          'La federación puede rechazar una solicitud o suspender una afiliación, informando el motivo, que lees en la plataforma. Las discrepancias se tratan con la federación, por sus canales. PickleRush no arbitra las decisiones de la federación, pero puede suspender el área de una federación que incumpla los Términos para Federaciones.',
          'Puedes cancelar tu afiliación en cualquier momento. La cancelación termina la validez del carnet y no genera reembolso automático. Al eliminar tu cuenta de PickleRush, tus afiliaciones quedan registradas en la federación sin tu nombre, y los códigos de carnet se borran.',
        ],
      },
    ],
  },
};
