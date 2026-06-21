// Contenido VERBATIM del "Reglamento y condiciones generales para operación de
// empresas y proveedores en el Hotel Humboldt". El texto NO se modifica; solo
// se completan los campos de la declaración final.

import { Logo } from "@/components/logo";

export interface ReglamentoFields {
  empresa: string;
  responsable: string;
  fecha: string;
  hora: string;
}

function Blank({ value }: { value: string }) {
  return (
    <span className="mx-1 inline-block min-w-32 border-b border-zinc-500 px-1 text-center font-medium">
      {value || " "}
    </span>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mt-2 text-justify">
      <span className="font-semibold">{label}:</span> {children}
    </p>
  );
}

export function ReglamentoTemplate({ fields }: { fields: ReglamentoFields }) {
  return (
    <article className="mx-auto max-w-4xl bg-white p-8 text-[13px] leading-relaxed text-zinc-900 print:max-w-none print:p-0">
      <header className="mb-5 flex items-center justify-between gap-4 border-b-2 border-sky-950 pb-4">
        <h1 className="text-lg font-bold text-sky-950">
          Reglamento y condiciones generales para operación de empresas y proveedores en el Hotel
          Humboldt
        </h1>
        <Logo className="h-12 w-auto shrink-0" />
      </header>

      <p className="text-justify">
        <span className="font-semibold">Objetivo:</span> el presente documento tiene como objetivo
        indicar a todas las empresas proveedoras, las normas y condiciones a cumplir a la hora de
        llevar a cabo un evento en las instalaciones del hotel Humboldt. Esto con la finalidad de
        preservar la infraestructura e instalaciones del mismo para el buen disfrute de nuestros
        visitantes.
      </p>

      <h2 className="mt-4 font-bold uppercase tracking-wide text-sky-950">Fase Pre-Evento</h2>
      <Item label="Visita de Inspección">
        es de carácter obligatorio que todas las empresas proveedoras hagan una visita de inspección
        a nuestras instalaciones. En dicha visita se revisarán todos los términos de este reglamento
        y estará asistido por un representante del Hotel Humboldt.
      </Item>
      <Item label="Horario de Ingreso">
        el horario permitido para el ingreso de transportes, para montaje y desmontaje en los salones
        y/o espacios estará sujeto a la normativa establecida por el Hotel Humboldt y el Parque
        Nacional El Ávila. Los oficiales de seguridad del Hotel indicaran a los conductores de
        vehículos de carga, el lugar a estacionar, sin que afecte la circulación o deterioro de las
        áreas.
      </Item>
      <Item label="Nivel de Responsabilidad">
        El proveedor contratado es responsable de todo daño que sufra las instalaciones e
        infraestructura antes, durante y luego de celebración del evento.
      </Item>
      <Item label="Uniforme del Personal">
        El personal de la empresa proveedora debe estar debidamente uniformado o vestido acorde a la
        ocasión, al momento de ingresar a las instalaciones del Hotel.
      </Item>
      <Item label="Ingreso de Mobiliario y Equipos">
        el ingreso de equipos y materiales solo se realizará por la zona de carga y descarga, que le
        sea previamente indicado por el personal del Hotel.
      </Item>
      <Item label="Montaje y Decoración">
        No está permitido el uso de cintas adhesivas, clavos, tornillos u otros objetos que dañen las
        paredes, puertas, barandas, ventanales, entre otros. Está prohibido bloquear las puertas de
        salida de emergencia y puertas de servicio. Así mismo toda empresa proveedora y empresas de
        decoración deben traer todos sus implementos de trabajo. El Hotel no está en la capacidad de
        prestar equipos tales como escaleras, martillos, carretillas, cables, cuerdas entre otros. El
        Hotel se reserva el derecho de suspender cualquier actividad de montaje o desmontaje dentro de
        sus instalaciones una vez detectado cualquier acto o condición insegura que pudiera generar un
        incidente de seguridad. No está permitido el desmontaje de bienes pertenecientes al Hotel,
        entiéndase murales, lámparas, ornamentos, entre otros.
      </Item>

      <h2 className="mt-4 font-bold uppercase tracking-wide text-sky-950">Fase Evento</h2>
      <Item label="Baño de Servicio">
        el Hotel destinara un baño de servicio para uso exclusivo del personal de servicio de los
        eventos.
      </Item>
      <Item label="Manejo de los Desperdicios">
        la empresa proveedora es responsable directo de la recolección de desperdicios originados por
        sus servicios (alimentos y bebidas, botellas, platos, servilletas, entre otros). La empresa
        proveedora debe cuidar los siguientes aspectos: No botar ningún desperdicio liquido y/o solido
        por las alcantarillas ni torrenteras. Usar doble bolsas transparentes para la basura, se
        recomienda no llenar totalmente las bolsas en los pasillos de servicio del Hotel, para que se
        pueda trasladar con mayor facilidad por las áreas de servicio hasta el punto de recolección.
        Las escaleras, ya que de esta forma se dejan rastros orgánicos en las áreas del Hotel. Todas
        las botellas y desperdicios originados por la empresa proveedora deben ser recogidos y
        dispuestos en el área de recolección.
      </Item>
      <Item label="Limpieza de las Áreas">
        La proveedora contratada es responsable de mantener la limpieza durante todo el evento en las
        áreas en uso, indicadas a continuación: área de carga, escaleras de servicio, pasillo de
        servicio.
      </Item>
      <p className="mt-2 text-justify">
        Se prohíbe el uso de Fuegos Pirotécnicos de cualquier tipo en cualquier área del Hotel, se
        prohíbe el uso de papelillos, confeti sin excepción.
      </p>
      <p className="mt-2 text-justify">
        Queda prohibido bloquear u obstaculizar las salidas de emergencia, así como los equipos de
        extinción contra incendios del Hotel.
      </p>
      <p className="mt-2 text-justify">
        Está prohibido fumar dentro de las instalaciones internas del Hotel. Recordamos que estamos en
        áreas pertenecientes a un Parque Nacional.
      </p>
      <p className="mt-2 text-justify">Queda totalmente prohibido el uso de armas de fuego.</p>
      <p className="mt-2 text-justify">
        En relación con las especificaciones para conexión de sonido y luces, la empresa proveedora
        acatara, las indicaciones especificadas por el personal del Hotel.
      </p>
      <p className="mt-2 text-justify">
        La empresa proveedora se compromete a mantener comunicaciones con el personal del Hotel, en
        caso de cambios en la logística necesaria para el montaje y desmontaje del evento.
      </p>

      <h2 className="mt-4 font-bold uppercase tracking-wide text-sky-950">Fase Post-Evento</h2>
      <Item label="Desmontaje de Equipos y Mobiliarios">
        el desmontaje de mobiliario y equipos debe iniciarse en los momentos finales del evento y se
        debe retirar todo lo que haya sido ingresado al área del evento, no haciéndose responsable el
        Hotel (la operadora) de perdidas, deterioro o daños causados a bienes, equipos y muebles
        propiedad de la proveedora. El Hotel no está en capacidad física de almacenar equipos de
        muebles. El ingreso de transporte debe estar dentro del horario permitido.
      </Item>
      <Item label="Recolección de los Desperdicios">
        toda la basura generada por el evento, incluyendo botellas, debe ser trasladada por la empresa
        proveedora desde el área del evento hasta el punto de recolección indicada por el personal del
        Hotel.
      </Item>
      <Item label="Limpieza de las Áreas">
        la empresa proveedora contratada es responsable de hacer la entrega del área limpia que haya
        utilizado al finalizar el evento.
      </Item>

      <div className="mt-8 break-inside-avoid-page border-t border-zinc-300 pt-4 text-justify">
        <p>
          Yo, <Blank value={fields.responsable} /> Responsable de la empresa Proveedora{" "}
          <Blank value={fields.empresa} /> declaro que es nuestro deber y responsabilidad cumplir con
          las normativas antes mencionadas. Igualmente, manifiesto mi compromiso de cumplir las
          mismas.
        </p>
        <div className="mt-8 flex gap-12">
          <p>
            Fecha: <Blank value={fields.fecha} />
          </p>
          <p>
            Hora: <Blank value={fields.hora} />
          </p>
        </div>
        <div className="mt-12 w-64 border-t border-zinc-500 pt-1 text-center text-xs text-zinc-600">
          Firma del responsable
        </div>
      </div>
    </article>
  );
}
