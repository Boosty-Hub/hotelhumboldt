// Contenido VERBATIM del "Contrato para la celebración de eventos en el Hotel".
// El texto de las cláusulas NO se modifica; solo se completan los datos variables
// del cliente, el evento y la fecha. La parte del Hotel (operadora y firmante) es
// fija, tal como en el documento original.

import { Logo } from "@/components/logo";

export interface ContratoFields {
  cliente: string; // razón social del cliente
  rif: string;
  direccion: string;
  representante: string; // persona que firma por el cliente
  cedula: string;
  fechaEvento: string; // ej. "12 de julio de 2025"
  horario: string; // ej. "03:00 P.M. A 12:00 A.M."
  contactoCliente: string; // persona contacto del cliente (cláusula XIII)
  fechaContratoLarga: string; // ej. "los 21 días del mes de junio de 2026"
  numeroCotizacion?: string; // cotización aprobada que origina el contrato (referencia)
}

// Parte fija del Hotel (idéntica al documento original).
const OPERADORA = "OPERADORA TURÍSTICA HUMBOLDT 1956, C.A.";
const HOTEL_CONTACTO = "LUIS EDUARDO SEMPRUN VAN GRIEKEN";

function Blank({ value }: { value: string }) {
  return (
    <span className="mx-0.5 inline-block min-w-24 border-b border-zinc-500 px-1 font-semibold">
      {value || " "}
    </span>
  );
}

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid-page">
      <h2 className="font-bold uppercase text-sky-950">{title}</h2>
      <div className="mt-1 space-y-2 text-justify">{children}</div>
    </section>
  );
}

export function ContratoTemplate({ fields: f }: { fields: ContratoFields }) {
  return (
    <article className="mx-auto max-w-4xl bg-white p-8 text-[13px] leading-relaxed text-zinc-900 print:max-w-none print:p-0">
      <header className="mb-4 flex items-center justify-between gap-4 border-b-2 border-sky-950 pb-4">
        <div>
          <h1 className="text-lg font-bold text-sky-950">
            Contrato para la celebración de eventos en el Hotel
          </h1>
          {f.numeroCotizacion ? (
            <p className="mt-0.5 text-xs font-medium text-zinc-600">
              Ref. Cotización N°: {f.numeroCotizacion}
            </p>
          ) : null}
        </div>
        <Logo className="h-12 w-auto shrink-0" />
      </header>

      <p className="text-justify">
        Entre, la Sociedad Mercantil {OPERADORA}, por una parte y por la otra la empresa:{" "}
        <Blank value={f.cliente} />, Registro de Información Fiscal RIF: <Blank value={f.rif} />,
        dirección: <Blank value={f.direccion} />, representado por el ciudadano:{" "}
        <Blank value={f.representante} />, titular de la cedula de identidad Nro.{" "}
        <Blank value={f.cedula} />, en condición de representante de la empresa, quien para efectos
        de este documento se denominará EL CLIENTE, se ha convenido celebrar el presente contrato
        para la realización del (los) eventos: en fecha <Blank value={f.fechaEvento} />, en varios
        espacios del Hotel, en horario comprendido entre las <Blank value={f.horario} /> (Si el
        CLIENTE es una persona Jurídica, la persona que firma este contrato garantiza que tiene la
        potestad para celebrar el presente contrato, en su representación, en los términos y
        condiciones aquí establecidos)
      </p>
      <p className="mt-2 text-justify">
        El CLIENTE podrá disponer, el día del evento de la fecha pautada, para preparar, organizar y
        ordenar el área contratada, a los fines de realizar pruebas de equipos y en general para
        disponer que todo se encuentre en orden. En caso de requerir un día adicional, antes o
        posterior al día del evento por razones de logísticas, el CLIENTE, deberá previo acuerdo y
        sujeto a disponibilidad existente de día y horas del Hotel, así como del Parque
        Waraira-Repano, cancelar un costo adicional.
      </p>

      <Clause title="Cláusula I: Garantía de reservación de los espacios">
        <p>
          La Operadora Turística Humboldt 1956, CA, garantiza únicamente el tiempo establecido en la
          COTIZACION, de los espacios solicitados en la fecha requerida. La COTIZACION, se anexa al
          presente contrato para que forme parte integrante del mismo, en el entendido que todo lo no
          regulado en el presente contrato, se regirá de acuerdo con lo establecido en la COTIZACION.
          En caso de existir contraindicaciones entre lo establecido en el presente contrato y lo
          contenido en la COTIZACION, regirá lo dispuesto en el presente contrato.
        </p>
        <p>
          <span className="font-semibold">PARAGRAFO UNICO:</span> Dicha garantía mantendrá su plena
          vigencia siempre y cuando el CLIENTE, dé estricto cumplimiento a las condiciones
          particulares y generales a las que se obliga mediante el presente contrato; sin embargo,
          queda entendido entre las partes que, en caso de incumplimiento por parte del CLIENTE, de
          cualesquiera de las condiciones pactadas en el presente contrato, la Operadora Turística
          Humboldt 1956 CA, quedará expresamente facultado para dejar sin efecto la garantía contenida
          en la presente cláusula, pudiendo disponer libremente del salón o espacio, sin que por ello
          pueda el CLIENTE pretender reclamación alguna.
        </p>
      </Clause>

      <Clause title="Cláusula II: Condiciones generales, formas de pago y horarios del evento">
        <p>
          <span className="font-semibold">Reservación:</span> La reservación procederá tan pronto el
          CLIENTE haya realizado los abonos acordados en la COTIZACION previamente aceptada.
        </p>
        <p>
          Todo evento, social o corporativo que se acuerde realizar por parte del Área de Ventas del
          Hotel Humboldt y el Cliente, deberán estar pagado al 100 %, en un máximo de 48 HORAS DE
          ANTELACION al mismo, SIN EXCEPCION, junto con la garantía para cubrir los gastos
          incidentales, (que será entre el 10% y 20%) según corresponda.
        </p>
        <p>
          <span className="font-semibold">Políticas de Retenciones:</span> El cliente, sea persona
          jurídica, natural o sujeto pasivo especial (contribuyente especial), deberá pagar a la
          Operadora, el 100% del monto acordado para la realización del evento. El Área de Contraloría
          y Finanzas, luego de obtener los comprobantes de las retenciones, procederá en un periodo
          máximo de 3 días hábiles al concluir el evento, a realizar el reintegro correspondiente. Los
          reintegros de las retenciones serán procesados únicamente en BOLIVARES.
        </p>
        <p>
          <span className="font-semibold">Garantía:</span> El CLIENTE, deberá entregar de acuerdo al
          evento que corresponda, la siguiente garantía: Evento Social, entre 10 y 20% (los mismos,
          dependerán del tipo de negociación con el área de ventas); Evento Corporativo 20%. Esta
          garantía, puede ser entregada en divisas en efectivo, transferencia vía Zelle y en Bolívares
          a la tasa BCV del día, cuarenta y ocho (48) horas antes de realizar el evento (negociación
          con el área de ventas). Las garantías serán re-embolsada en la misma forma de pago recibida
          en un máximo de 3 días hábiles al culminar el evento, luego de constatar que no se hayan
          producido gastos incidentales para la prestación de algún servicio o cargos extras, que
          serán cobrados de acuerdo a la lista de precios anexa a la COTIZACION a la que se ha hecho
          referencia. En dicho caso, de ocurrir, se descontará el monto correspondiente.
        </p>
        <p>
          <span className="font-semibold">Horarios:</span> Los horarios establecidos en la COTIZACION,
          deben ser respetados, de lo contrario, la Operadora Turística Humboldt 1956 CA, tendrá
          derecho a efectuar cargos adicionales que podrán ser descontados del depósito en garantía.
        </p>
      </Clause>

      <Clause title="Cláusula III: Incumplimiento de la cotización">
        <p>
          En el supuesto que el CLIENTE, incumpla cualquiera de las condiciones descritas en la
          COTIZACION aceptada, la Operadora Turística Humboldt 1956 CA, se reserva el derecho de
          cambiar o cancelar los espacios asignados, sin que esto implique responsabilidad alguna para
          la Operadora, ni la obligación de pago de indemnización alguna al CLIENTE.
        </p>
      </Clause>

      <Clause title="Cláusula IV: Impuesto y cargo por servicio">
        <p>
          A todo servicio prestado por la Operadora Turística Humboldt 1956 CA, se le deberá aplicar
          el monto correspondiente al Valor Agregado (IVA) vigente para el momento. Todos nuestros
          precios están sujetos a cambio sin previo aviso.
        </p>
      </Clause>

      <Clause title="Cláusula V: Cancelación / penalización / cambio de fecha de celebración del evento e indemnización">
        <p>
          Si el evento se suspende o cancela por cualquier causa o motivo imputable al CLIENTE, la
          Operadora Turística Humboldt 1956 CA, descontará el ochenta por ciento (80%) sobre los pagos
          abonados en la COTIZACION, por concepto de indemnización por los daños y perjuicios que
          dicha suspensión o cancelación le hubieran ocasionado a la Operadora Turística Humboldt 1956
          CA.
        </p>
        <p>
          Por el contrario, si el evento se suspende o cancela por cualquier causa o motivo imputable
          a la Operadora Turística Humboldt 1956 CA, la Operadora, deberá rembolsar al Cliente, el
          cien por ciento (100%) de los pagos abonados, o reprogramar el evento, si el Cliente
          decidiera llegar a un acuerdo.
        </p>
        <p>
          De ser necesario posponer la fecha del evento, la celebración del mismo en la nueva fecha
          propuesta, quedará condicionada a la disponibilidad de espacios que tenga la Operadora, sin
          que esto implique compromiso alguno por parte de la Operadora Turística Humboldt 1956 CA.
        </p>
      </Clause>

      <Clause title="Cláusula VI: Suministro de alimentos">
        <p>
          La Operadora Turística Humboldt 1956 CA, se compromete a hacer sus mejores esfuerzos para
          suministrar los alimentos acordados en la COTIZACION aprobada.
        </p>
        <p>
          El CLIENTE se compromete a cumplir las condiciones incluidas en la COTIZACION, en relación
          al número de personas que asistirán al evento con base al cual se han previsto, los espacios,
          montajes y servicios. Todo cambio deberá ser notificado con por lo menos setenta y dos (72)
          horas hábiles a la fecha de inicio del evento. Ese cambio no podrá implicar la variación de
          más de un diez por ciento (10 %) del consumo acordado, pues de lo contrario la Operadora
          Turística Humboldt 1956 CA, no garantiza la disponibilidad para hacer frente a los servicios
          de conformidad con lo acordado en la COTIZACION. En caso de excederse el número de personas
          al momento del evento, la Operadora Turística Humboldt 1956 CA, no se comprometa a servir el
          mismo menú acordado en la COTIZACION. En cuyo caso se servirá lo que la cocina del Hotel
          tenga disponible de acuerdo con el número de comensales finales. Por políticas internas de la
          Operadora Turística Humboldt 1956 CA, así como, normativas de índole sanitaria, bajo ningún
          concepto se autoriza al CLIENTE, ni a interpuestas personas, retirar de las instalaciones,
          los alimentos ya producidos y procesados. Todos los alimentos solicitados deberán ser
          consumidos durante el evento. También está prohibido, traer alimentos para ser consumidos en
          las instalaciones del Hotel.
        </p>
      </Clause>

      <Clause title="Cláusula VII: Exoneración a la Operadora Turística Humboldt 1956 CA, de responsabilidades por daños y reclamos a terceros">
        <p>
          EL CLIENTE se obliga a tomar todas las previsiones que pudiesen surgir por daños a terceros
          ocurridos en la ejecución del evento previsto en el presente documento, en donde estén
          involucrados invitados y proveedores contratados, derivados de todo tipo de accidentes
          (caídas, problemas de salud, eventos en contra de las personas, riñas, homicidios, suicidios
          y lesiones), quedando LA OPERADORA exonerada de las obligaciones que pudieran surgir a
          propósito de las situaciones antes descritas.
        </p>
        <p>
          EL CLIENTE reconoce que el Hotel Humboldt, en los actuales momentos no se encuentra en un
          cien por ciento de operatividad, por lo cual exime a LA OPERADORA de cualquier tipo de
          responsabilidad, por deterioro en sus instalaciones que menoscaben la realización del evento
          de manera óptima.
        </p>
      </Clause>

      <Clause title="Cláusula VIII: Equipos y materiales">
        <p>
          Sólo se permitirá la entrada de los materiales, equipos y artículos de decoración, indicados
          en el listado o listados remitidos por el CLIENTE a tales efectos, sin que esto implique
          responsabilidad alguna para la Operadora Turística Humboldt 1956 CA.
        </p>
        <p>
          Una vez concluido el evento, EL CLIENTE deberá dejar una persona autorizada para la custodia
          de aquellos equipos, máquinas u otro tipo de mobiliario, de su propiedad, o de cualesquiera
          de los proveedores por ellos contratados, que fueron utilizados para el desarrollo del
          evento, el cual será responsable de los mismos hasta su efectivo retiro de las instalaciones
          del Hotel, según las especificaciones contenida en el Reglamento de Proveedores.
        </p>
      </Clause>

      <Clause title="Cláusula IX: Prohibición de cesión y subrogación">
        <p>
          EL CLIENTE no podrá ceder ni subrogar a terceros los derechos otorgados por el presente
          documento, bajo pena de resolución inmediata del Contrato.
        </p>
      </Clause>

      <Clause title="Cláusula X: Derecho de admisión">
        <p>
          La Operadora Turística Humboldt 1956 CA, se reserva el derecho de personas en todo tipo de
          evento que violente con las normativas de vestimenta y apariencia. Asimismo, el CLIENTE se
          compromete a conducir la reunión o evento dentro de las normas de la moral y las buenas
          costumbres de manera ordenada y pacífica y en el estricto cumplimiento con los reglamentos
          internos de la Operadora.
        </p>
      </Clause>

      <Clause title="Cláusula XI: Cumplimiento de leyes">
        <p>
          El Hotel Humboldt es patrimonio arquitectónico del país registrado en el instituto del
          patrimonio cultural, está ubicado en el Parque Nacional Waraira Repano, por lo que sus
          visitantes en general se encuentran sujetos a normas y limitaciones establecidas entre
          otras, en Ley Orgánica de Bienes Publico, Ley del Instituto Nacional de Parques, Ley de
          Protección y Defensa del Patrimonio Cultural, Plan de Ordenamiento y Reglamento de uso del
          Parque Nacional, Ley Orgánica del ambiente, así como cualquier otra providencia relativas a
          la materia, que declara conocer El CLIENTE.
        </p>
        <p>
          No podrá celebrarse el evento, aun habiendo cumplido los requisitos para reservas
          establecidos en este contrato, si el CLIENTE no le demuestra a la Operadora Turística
          Humboldt 1956 CA, haber obtenido todos los permisos y autorizaciones obtenidas por todas las
          autoridades competentes de ser el caso.
        </p>
        <p>
          Para el caso de que no lo probara, el hotel se reserva proceder a su único y exclusivo
          criterio, de conformidad con lo previsto en el Parágrafo Único de la Cláusula I de este
          contrato.
        </p>
        <p>
          La Operadora Turística Humboldt 1956 CA, no se hace responsable de la suspensión o
          cancelación del evento derivados de actos de la Administración Municipal, Estadal o Nacional,
          sin importar el motivo de los mismos. El CLIENTE asume toda la responsabilidad derivada de
          los derechos de autor y de propiedad industrial que pudieran estar relacionados con el
          evento y, expresamente exime a la Operadora Turística Humboldt 1956 CA, de toda
          responsabilidad por posibles reclamos generados por estos conceptos o por la suspensión del
          evento por violación de las mismas.
        </p>
      </Clause>

      <Clause title="Cláusula XII: Fuerza mayor">
        <p>
          No será considerado incumplimiento de los términos y condiciones establecidos en el presente
          contrato imputable a las partes, si el evento no pudiera efectuarse de conformidad con el
          presente contrato porque las operaciones normales del Hotel, se vieran afectados por
          situaciones de disturbios políticos, conmoción civil, huelgas, causas naturales, disputas
          laborales o acciones, así como cualquier otra causa de fuerza mayor. En caso de ocurrir lo
          anterior, la Operadora Turística Humboldt 1956 CA, reintegrará al CLIENTE todos los pagos
          abonados, a cuyos efectos deberá dar cumplimiento al procedimiento establecido en la cláusula
          V de este contrato, en relación con la solicitud de reintegro y el plazo para ello. Sin
          embargo, el evento podrá ser pospuesto a elección del CLIENTE, según la disponibilidad de
          espacio de la Operadora Turística Humboldt 1956 CA, previos reajustes de precios en la
          COTIZACION, de ser el caso.
        </p>
      </Clause>

      <Clause title="Cláusula XIII: Notificaciones">
        <p>
          Cualquier comunicación y/o notificación que deba efectuarse entre las partes con ocasión del
          presente contrato, se realizará por medio de carta escrita con acuse de recibo, o correos
          electrónicos enviado a las siguientes direcciones:
        </p>
        <p>
          Operadora Turística Humboldt 1956 CA — Persona contacto: {HOTEL_CONTACTO}
        </p>
        <p>
          EL CLIENTE — Persona contacto: <Blank value={f.contactoCliente} />
        </p>
      </Clause>

      <Clause title="Cláusula XIV: Prohibición de cesión. Acuerdo único, modificaciones y vigencia">
        <p>
          Este contrato se considera celebrado INTUITU PERSONAE, no pudiendo ser traspasado o cedido
          sin la autorización previa dada por escrito por la otra parte. El presente contrato y sus
          anexos, constituyen el entendimiento único entre las partes con respecto al objeto del mismo
          e invalida y sustituye en su totalidad cualquier entendimiento anterior bien sea verbal o por
          escrito. Este contrato y sus anexos, no podrán modificarse sin el previo consentimiento por
          escrito firmado por ambas partes. La vigencia de este contrato comienza a partir de su firma
          y se extenderá hasta la finalización y desmontaje del evento o hasta que todas las
          obligaciones asumidas por las partes hayan sido cumplidas, si esto ocurre en fecha posterior
          al evento.
        </p>
      </Clause>

      <Clause title="Cláusula XV: Ley aplicable y domicilio">
        <p>
          El presente contrato se regirá por las leyes de la República Bolivariana de Venezuela. Las
          partes eligen como domicilio especial y excluyente la ciudad de Caracas, a cuyos Tribunales
          acuerdan someter cualquier controversia derivada del presente contrato.
        </p>
      </Clause>

      <p className="mt-4 text-justify">
        En la ciudad de Caracas, a {f.fechaContratoLarga}.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-8 break-inside-avoid-page text-center text-xs">
        <div>
          <div className="border-t border-zinc-500 pt-1">{HOTEL_CONTACTO}</div>
          <p className="mt-1 text-zinc-600">Operadora Turística Humboldt 1956, CA</p>
        </div>
        <div>
          <div className="border-t border-zinc-500 pt-1">{f.representante || " "}</div>
          <p className="mt-1 text-zinc-600">{f.cliente || "EL CLIENTE"}</p>
        </div>
      </div>
    </article>
  );
}
