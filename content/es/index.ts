import type { SiteContent } from "../types";

export const esContent = {
  locale: "es",
  shared: {
    siteName: "HELP Math",
    siteTagline: "El lenguaje matemático, a la vista",
    skipToContent: "Ir al contenido principal",
    statusLabel: "Modernización en curso",
    statusMessage:
      "HELP Math se está restaurando cuidadosamente para la web actual. Hay demostraciones públicas y asistencia; las cuentas de estudiantes aún no están activas.",
    externalLinkLabel: "Se abre en una pestaña nueva",
    requiredFieldLabel: "Obligatorio",
    navigation: {
      ariaLabel: "Navegación principal",
      homeLabel: "Página principal de HELP Math",
      links: [
        { label: "El proyecto", href: "/es/about" },
        { label: "Enfoque", href: "/es/approach" },
        { label: "Currículo", href: "/es/curriculum" },
        { label: "Investigación", href: "/es/research" },
        { label: "Recursos", href: "/es/resources" },
        { label: "Demostraciones", href: "/es/demos" },
      ],
      supportAction: { label: "Obtener asistencia", href: "/es/support" },
      languageLabel: "Idioma",
      languageNames: { en: "English", es: "Español" },
      openMenuLabel: "Abrir la navegación",
      closeMenuLabel: "Cerrar la navegación",
    },
    footer: {
      summary:
        "HELP Math integra las ideas matemáticas y el lenguaje académico para estudiantes multilingües y para quienes se benefician de apoyo adicional.",
      exploreLabel: "Explorar",
      helpLabel: "Ayuda y políticas",
      exploreLinks: [
        { label: "Nuestro enfoque", href: "/es/approach" },
        { label: "Currículo", href: "/es/curriculum" },
        { label: "Archivo de investigación", href: "/es/research" },
        { label: "Demostraciones JavaScript", href: "/es/demos" },
      ],
      helpLinks: [
        { label: "Asistencia", href: "/es/support" },
        { label: "Contacto", href: "/es/contact" },
        { label: "Privacidad", href: "/es/privacy" },
        { label: "Términos", href: "/es/terms" },
      ],
      languageNote: "El contenido del sitio está disponible en inglés y español.",
      legalNote:
        "HELP Math está en restauración activa. Las descripciones históricas del programa se identifican como contexto de archivo, no como promesas actuales del producto.",
    },
  },
  pages: {
    home: {
      metadata: {
        title: "El lenguaje matemático, a la vista",
        description:
          "Conozca el proyecto moderno HELP Math: apoyo matemático bilingüe, contexto de investigación, demostraciones interactivas restauradas y ayuda para educadores y estudiantes que regresan.",
      },
      hero: {
        eyebrow: "Bienvenidos de nuevo a HELP Math",
        title: "Descubre el lenguaje dentro de cada idea matemática.",
        summary:
          "HELP Math conecta modelos visuales, explicaciones claras, vocabulario académico y práctica guiada para que los estudiantes multilingües comprendan tanto las matemáticas como las palabras que se usan para describirlas.",
        primaryAction: { label: "Explorar las demostraciones", href: "/es/demos" },
        secondaryAction: { label: "Obtener ayuda con el proyecto", href: "/es/support" },
        supportingNote:
          "El nuevo sitio web es una versión preliminar pública. Las actividades restauradas son demostraciones mientras se evalúa la plataforma educativa más amplia.",
      },
      status: {
        label: "Estado del proyecto",
        title: "Una reconstrucción cuidadosa, no una copia del sitio antiguo",
        body:
          "Conservamos las ideas didácticas de HELP Math y sustituimos la tecnología obsoleta por experiencias web accesibles y sostenibles. Esta versión no incluye cuentas, tareas ni registros de progreso estudiantil.",
        action: { label: "Leer el estado de la modernización", href: "/es/about#today" },
      },
      audiences: {
        eyebrow: "Diseñado en torno a necesidades reales",
        title: "Un camino más claro hacia el significado matemático",
        intro:
          "Cada estudiante puede necesitar un punto de entrada distinto. La experiencia pública restaurada de HELP Math se centra en la explicación, el lenguaje y las representaciones de apoyo.",
        cards: [
          {
            id: "multilingual-learners",
            title: "Para estudiantes multilingües",
            description:
              "Conecta el lenguaje cotidiano, el vocabulario académico, los símbolos y los modelos visuales sin reducir la meta matemática.",
          },
          {
            id: "students-needing-support",
            title: "Para quienes necesitan otra vía",
            description:
              "Divide ideas complejas en pasos visibles y pausados, y ofrece varias formas de reconocer relaciones y patrones.",
          },
          {
            id: "educators",
            title: "Para educadores",
            description:
              "Examina el enfoque didáctico, explora ejemplos restaurados y ayuda a definir los próximos pasos responsables del proyecto.",
          },
        ],
      },
      approach: {
        eyebrow: "Cómo enseña HELP Math",
        title: "Las palabras, las representaciones y el razonamiento trabajan juntos",
        intro:
          "El programa histórico combinaba la enseñanza de matemáticas con apoyos lingüísticos. La modernización mantiene esa idea central visible en cada actividad restaurada.",
        cards: [
          {
            id: "make-language-explicit",
            title: "Hacer explícito el lenguaje",
            description:
              "Presenta términos clave en contexto y los conecta con símbolos, acciones, diagramas y ejemplos.",
          },
          {
            id: "show-relationships",
            title: "Mostrar las relaciones",
            description:
              "Usa animación y representaciones manipulables para revelar qué cambia, qué permanece y por qué.",
          },
          {
            id: "pace-the-thinking",
            title: "Dar ritmo al pensamiento",
            description:
              "Segmenta las explicaciones en pasos intencionales para atender una relación a la vez.",
          },
        ],
        action: { label: "Conocer el enfoque didáctico", href: "/es/approach" },
      },
      demos: {
        eyebrow: "Objetos de aprendizaje restaurados",
        title: "Prueba dos primeras demostraciones en JavaScript",
        intro:
          "Estas actividades breves muestran cómo el material histórico de HELP Math puede convertirse en experiencias nativas del navegador, nítidas y utilizables con teclado.",
        items: [
          {
            id: "conversion-1-2",
            title: "Conversión 1.2",
            description:
              "Explora una secuencia reconstruida cuidadosamente, con tiempos deterministas y gráficos vectoriales adaptables.",
            detail: "Demostración moderna en JavaScript",
            action: { label: "Abrir Conversión 1.2", href: "/es/demos/conversion-1-2" },
          },
          {
            id: "conversion-1-4",
            title: "Conversión 1.4",
            description:
              "Observa otra actividad restaurada y cómo el movimiento, las etiquetas y la repetición apoyan la explicación.",
            detail: "Demostración moderna en JavaScript",
            action: { label: "Abrir Conversión 1.4", href: "/es/demos/conversion-1-4" },
          },
        ],
        note:
          "Una demostración solo se publica tras revisar su fuente, secuencia temporal, comportamiento y estados visuales clave. Las demostraciones no recopilan trabajo estudiantil.",
      },
      closing: {
        title: "¿Regresas a HELP Math? Queremos orientarte.",
        body:
          "Cuéntanos si buscas una cuenta antigua, materiales del programa, información de investigación o una futura colaboración. No incluyas expedientes estudiantiles ni contraseñas.",
        action: { label: "Contactar con el proyecto", href: "/es/contact" },
      },
    },
    about: {
      metadata: {
        title: "Acerca de HELP Math",
        description:
          "Conoce para qué se diseñó HELP Math, qué se está preservando y qué incluye y no incluye la modernización actual.",
      },
      hero: {
        eyebrow: "Acerca del proyecto",
        title: "Preservamos una idea didáctica que vale la pena reconstruir",
        summary:
          "HELP Math —nombre que históricamente significaba Help with English Language Proficiency— se diseñó para desarrollar la comprensión matemática junto con el lenguaje académico que el alumnado necesita para participar en el aprendizaje de matemáticas.",
        primaryAction: { label: "Explorar nuestro enfoque", href: "/es/approach" },
        secondaryAction: { label: "Ver el archivo de investigación", href: "/es/research" },
      },
      story: [
        {
          id: "purpose",
          eyebrow: "El propósito original",
          title: "Las matemáticas y el lenguaje pertenecen a la misma lección",
          paragraphs: [
            "Los materiales históricos describen HELP Math como una intervención web para estudiantes de inglés y para otras personas que se benefician de apoyo matemático adicional.",
            "Su propósito didáctico no era simplemente traducir instrucciones. Las lecciones conectaban conceptos matemáticos con vocabulario académico, modelos visuales, explicaciones orales y escritas, práctica guiada y apoyo bilingüe.",
          ],
        },
        {
          id: "preservation",
          eyebrow: "Lo que preservamos",
          title: "La estructura didáctica antes que la nostalgia tecnológica",
          paragraphs: [
            "El archivo del proyecto incluye fuentes de lecciones, medios interactivos, descripciones del programa y materiales de investigación de distintos periodos de la historia de HELP Math.",
            "La restauración trata esos archivos como evidencia. Conserva explicaciones significativas, ritmo, apoyos lingüísticos e interacciones del estudiante a la vez que reemplaza la tecnología obsoleta del navegador.",
          ],
        },
        {
          id: "today",
          eyebrow: "Nuestra situación actual",
          title: "Una fase de sitio público y demostraciones",
          paragraphs: [
            "Esta versión presenta el proyecto, facilita la revisión de evidencia seleccionada y publica un conjunto pequeño de demostraciones JavaScript en fase de revisión.",
            "Todavía no sustituye la antigua plataforma educativa. Este sitio no ofrece cuentas activas, clases, tareas, compras ni informes de progreso.",
          ],
        },
      ],
      principles: {
        eyebrow: "Principios de modernización",
        title: "Qué orienta cada decisión",
        cards: [
          {
            id: "evidence",
            title: "Evidencia antes que afirmaciones",
            description:
              "Separamos los registros históricos fechados de las afirmaciones verificadas de manera independiente para el uso actual.",
          },
          {
            id: "access",
            title: "Acceso desde el diseño",
            description:
              "Diseño adaptable, teclado, contraste legible, alternativas textuales y movimiento reducido forman parte de la construcción.",
          },
          {
            id: "language",
            title: "Lenguaje con dignidad",
            description:
              "Los apoyos bilingües y de lenguaje académico deben ampliar el acceso a ideas rigurosas, nunca indicar expectativas menores.",
          },
          {
            id: "privacy",
            title: "Primero la privacidad estudiantil",
            description:
              "El lanzamiento público no recopila datos de aprendizaje ni pide al alumnado crear cuentas.",
          },
        ],
      },
      today: {
        title: "Ayúdanos a comprender cómo se utilizó HELP Math",
        body:
          "Educadores, colaboradores e investigadores anteriores pueden compartir contexto no confidencial sobre la historia del programa. No envíes nombres o expedientes de estudiantes, credenciales ni materiales protegidos que no estés autorizado a compartir.",
        action: { label: "Contactar con el equipo de restauración", href: "/es/contact?topic=project-history" },
      },
    },
    approach: {
      metadata: {
        title: "Enfoque didáctico",
        description:
          "Descubre cómo HELP Math integra lenguaje académico, representaciones visuales, explicaciones pausadas y apoyo bilingüe alrededor de ideas matemáticas rigurosas.",
      },
      hero: {
        eyebrow: "Enfoque didáctico",
        title: "Hacer más visibles las matemáticas y su lenguaje",
        summary:
          "El diseño histórico de HELP Math se inspira en la instrucción protegida: explicitar el significado, conectar el lenguaje con las representaciones, segmentar razonamientos complejos y ofrecer oportunidades de participación con apoyo y con la misma meta matemática.",
        primaryAction: { label: "Probar una demostración restaurada", href: "/es/demos" },
        secondaryAction: { label: "Revisar el contexto curricular", href: "/es/curriculum" },
      },
      foundations: {
        eyebrow: "Cuatro fundamentos",
        title: "Apoyos que permanecen conectados con la idea",
        intro:
          "Cada capa debe ayudar a razonar, no decorar la pantalla ni sustituir el pensamiento productivo.",
        cards: [
          {
            id: "academic-language",
            title: "Lenguaje académico en contexto",
            description:
              "Define y retoma los términos donde cumplen una función matemática; conecta palabras como equivalente, convertir y representar con relaciones visibles.",
          },
          {
            id: "multiple-representations",
            title: "Múltiples representaciones",
            description:
              "Coordina números, símbolos, diagramas, objetos manipulables y explicaciones orales o escritas para conectar distintas formas de significado.",
          },
          {
            id: "segmentation",
            title: "Segmentación intencional",
            description:
              "Divide las explicaciones en momentos coherentes, controla el ritmo y deja tiempo suficiente para notar la relación que se estudia.",
          },
          {
            id: "bilingual-support",
            title: "Apoyo bilingüe",
            description:
              "Usa el español como puente a la comprensión y mantiene visibles y significativos los términos académicos importantes en inglés.",
          },
        ],
      },
      learningSequence: {
        eyebrow: "Una secuencia de aprendizaje",
        title: "De la orientación al razonamiento independiente",
        intro:
          "Los patrones exactos de las lecciones varían, pero la experiencia restaurada sigue un recorrido didáctico transparente.",
        steps: [
          {
            id: "orient",
            step: "01",
            title: "Orientar",
            description:
              "Nombra la meta, activa conocimientos previos útiles y presenta el lenguaje que será necesario.",
          },
          {
            id: "model",
            step: "02",
            title: "Modelar",
            description:
              "Hace visible una relación mediante un ejemplo resuelto, representaciones coordinadas y una explicación concisa.",
          },
          {
            id: "interact",
            step: "03",
            title: "Interactuar",
            description:
              "Permite predecir, repetir, manipular o comparar para mantener la atención en la estructura matemática.",
          },
          {
            id: "practice",
            step: "04",
            title: "Practicar y explicar",
            description:
              "Avanza hacia el trabajo independiente e invita a usar el lenguaje objetivo para describir el razonamiento.",
          },
        ],
      },
      supportLayers: {
        id: "support-layers",
        eyebrow: "Apoyo disponible",
        title: "Añadir apoyo sin ocultar las matemáticas",
        paragraphs: [
          "Una actividad moderna puede combinar texto conciso, narración, énfasis visual, conexión con un glosario, apoyo en español, repetición y ritmo controlado por el estudiante.",
          "No todas las actividades necesitan todos los apoyos. La meta es que cada apoyo tenga propósito, pueda percibirse y pueda retirarse cuando ya no sea necesario.",
        ],
        bullets: [
          "Mantener las etiquetas cerca de las representaciones que describen.",
          "Usar el movimiento para explicar cambios, no para competir por la atención.",
          "Permitir pausa y repetición sin alterar la secuencia didáctica.",
          "Redactar español e inglés como experiencias completas, no como fragmentos de interfaz traducidos palabra por palabra.",
        ],
      },
      teacherRole: {
        title: "La tecnología apoya la enseñanza; los educadores orientan su uso.",
        body:
          "Las demostraciones públicas muestran objetos de aprendizaje, no un curso completo ni un sistema docente automatizado. Los educadores son esenciales para elegir tareas apropiadas, escuchar el razonamiento del alumnado y conectar las actividades con las metas del aula.",
        action: { label: "Hacer una consulta didáctica", href: "/es/contact?topic=instruction" },
      },
    },
    curriculum: {
      metadata: {
        title: "Currículo",
        description:
          "Explora los dominios históricos del currículo HELP Math, su flujo de lección y los límites del material disponible actualmente en el sitio moderno.",
      },
      hero: {
        eyebrow: "Contexto curricular",
        title: "Un archivo amplio que regresa pieza por pieza, después de validarse",
        summary:
          "Los materiales históricos describen configuraciones de HELP Math para los últimos grados de primaria y los grados intermedios, además de usos de refuerzo. El sitio actual publica demostraciones seleccionadas, no el currículo histórico completo.",
        primaryAction: { label: "Ver las demostraciones actuales", href: "/es/demos" },
        secondaryAction: { label: "Solicitar información curricular", href: "/es/contact?topic=curriculum" },
      },
      archiveNotice: {
        title: "Por qué no publicamos una sola cifra de lecciones u horas",
        body:
          "Los documentos archivados describen distintas ediciones y alcances propuestos, incluidas configuraciones de 3.º a 8.º y de 6.º a 8.º grado. Se están conciliando esos registros antes de publicar un catálogo actual o afirmaciones sobre alineación y disponibilidad.",
      },
      domains: {
        eyebrow: "Dominios históricos de contenido",
        title: "Ideas matemáticas representadas en el archivo",
        intro:
          "El archivo incluye trabajo en cuatro grandes dominios. La cobertura y la secuencia varían según la edición histórica y siguen en auditoría.",
        cards: [
          {
            id: "numbers",
            title: "Números y operaciones",
            description:
              "Valor posicional, relaciones numéricas, fracciones, decimales, razonamiento proporcional y operaciones con lenguaje y modelos visuales.",
          },
          {
            id: "geometry",
            title: "Geometría y medición",
            description:
              "Propiedades, relaciones espaciales, unidades, medición y razonamiento geométrico visibles mediante diagramas y manipulación.",
          },
          {
            id: "algebra",
            title: "Patrones y pensamiento algebraico",
            description:
              "Patrones, variables, expresiones, ecuaciones y el lenguaje utilizado para describir relaciones generales.",
          },
          {
            id: "data",
            title: "Datos y probabilidad",
            description:
              "Leer, representar, comparar y razonar a partir de datos mediante gráficas, cantidades y explicaciones coordinadas.",
          },
        ],
      },
      lessonFlow: {
        eyebrow: "Diseño de objetos de aprendizaje",
        title: "Cómo puede desarrollarse una lección restaurada",
        steps: [
          {
            id: "goal-language",
            step: "1",
            title: "Definir la meta y el lenguaje",
            description:
              "Aclara el propósito matemático, los conocimientos previos relevantes y las palabras que aparecerán.",
          },
          {
            id: "concept-development",
            step: "2",
            title: "Desarrollar el concepto",
            description:
              "Usa representaciones sincronizadas y ejemplos pausados para revelar una relación clave.",
          },
          {
            id: "guided-application",
            step: "3",
            title: "Aplicar con apoyo",
            description:
              "Ofrece elecciones significativas, retroalimentación, repetición y andamiaje lingüístico durante la práctica.",
          },
          {
            id: "reflect-check",
            step: "4",
            title: "Reflexionar y comprobar",
            description:
              "Invita a explicar y comprueba la comprensión sin tratar una sola interacción como medida completa del dominio.",
          },
        ],
      },
      availability: {
        id: "availability",
        eyebrow: "Lo que está disponible ahora",
        title: "Demostraciones, no matrículas",
        paragraphs: [
          "El sitio moderno ofrece actualmente demostraciones públicas de objetos de aprendizaje e información del proyecto. No incluye lecciones completas, pruebas de ubicación, paneles docentes, tareas de clase ni almacenamiento del progreso estudiantil.",
          "La futura publicación curricular depende de auditorías de fuentes y derechos, revisión didáctica, trabajo de accesibilidad y validación frente al comportamiento original.",
        ],
      },
      closing: {
        title: "¿Buscas una lección o un documento histórico de alcance?",
        body:
          "Envía una solicitud de contacto de un adulto con el tema y el uso previsto. Confirmaremos qué puede compartirse y si hay una copia accesible.",
        action: { label: "Solicitar información curricular", href: "/es/contact?topic=curriculum" },
      },
    },
    research: {
      metadata: {
        title: "Archivo de investigación y evidencia",
        description:
          "Consulta contexto histórico de investigación de HELP Math, registros archivados y las normas de evidencia que orientan las afirmaciones públicas actuales.",
      },
      hero: {
        eyebrow: "Investigación y evidencia",
        title: "Mantener visible la historia y precisar las afirmaciones",
        summary:
          "El archivo de HELP Math incluye descripciones de investigaciones, materiales de subvenciones, reseñas y premios de distintos periodos. Esta página los identifica como evidencia histórica hasta poder comprobar cada fuente y su relevancia actual de manera independiente.",
        primaryAction: { label: "Solicitar una fuente", href: "/es/contact?topic=research" },
        secondaryAction: { label: "Conocer el proyecto", href: "/es/about" },
      },
      evidenceNotice: {
        title: "Una declaración archivada no es una afirmación actual de eficacia",
        body:
          "Importan las fechas, poblaciones del estudio, condiciones de comparación, medidas de resultados, versiones del producto e informes originales. No reutilizamos expresiones como «único», «líder», «mejor calificado» o «probado por la investigación» sin respaldo actual que pueda revisarse directamente.",
      },
      entriesLabel: "Registro de evidencia",
      entries: [
        {
          id: "program-description-2014",
          title: "Descripción del programa About HELP Math",
          dateLabel: "Documento archivado creado en 2014",
          status: "archived",
          statusLabel: "Contexto de archivo",
          summary:
            "Descripción general de los estudiantes previstos, los apoyos de lenguaje académico, el diseño de lecciones, el alcance curricular histórico y la narrativa de investigación.",
          interpretation:
            "Es útil para comprender la intención de diseño. Las cifras y afirmaciones específicas requieren confirmación frente a la edición y las fuentes primarias correspondientes.",
          sourceLabel: "Archivo local: About HELP Math.pdf",
        },
        {
          id: "html5-proposal-2020",
          title: "Propuesta de fase I de HELP Math con HTML5",
          dateLabel: "Propuesta archivada creada en 2020",
          status: "context",
          statusLabel: "Contexto de diseño",
          summary:
            "Propuesta que vincula la modernización de HELP Math con aprendizaje multimedia, instrucción protegida, andamiaje, segmentación, desarrollo de vocabulario y manipulación virtual.",
          interpretation:
            "Documenta una dirección de modernización propuesta. Una propuesta no demuestra que todas sus funciones se hayan implementado o evaluado.",
          sourceLabel: "Archivo local: BoulderLearning.PhaseI.HMwithHTML5.pdf",
        },
        {
          id: "scope-2020",
          title: "Alcance de HELP Math 2.0",
          dateLabel: "Documento de alcance archivado creado en 2020",
          status: "context",
          statusLabel: "Alcance propuesto",
          summary:
            "Documento de planificación que describe una visión más amplia de plataforma, evaluación diagnóstica, apoyos personalizables, expansión de contenidos y actualizaciones tecnológicas.",
          interpretation:
            "Muestra la aspiración del producto, no la funcionalidad del sitio actual. Las funciones propuestas no se describen como disponibles sin verificación independiente.",
          sourceLabel: "Archivo local: HELP Math 2.0 Scope.pdf",
        },
        {
          id: "historical-review-records",
          title: "Reseñas y premios externos históricos",
          dateLabel: "Fechas y registros en revisión",
          status: "verification",
          statusLabel: "Requiere verificación",
          summary:
            "Las páginas antiguas aluden a materiales federales de revisión de investigaciones, subvenciones educativas, cobertura periodística y premios del sector.",
          interpretation:
            "Estas referencias se fecharán y vincularán con registros primarios antes de presentarlas como logros verificados en el sitio moderno.",
          sourceLabel: "Sitio antiguo y archivo del proyecto",
        },
      ],
      reviewPolicy: {
        id: "review-policy",
        eyebrow: "Política de evidencia",
        title: "Qué registramos antes de publicar una afirmación",
        paragraphs: [
          "Toda afirmación sustantiva de eficacia o reconocimiento debe señalar una fuente que se pueda consultar. Si una fuente no está disponible o describe una versión anterior, esa limitación acompaña a la afirmación.",
        ],
        bullets: [
          "Cita completa y ubicación estable de la fuente",
          "Fecha de publicación o del premio",
          "Versión del producto y alcance curricular",
          "Muestra, diseño, medidas y condición de comparación cuando corresponda",
          "Resultado expresado en proporción a la evidencia",
          "Conflictos conocidos entre fuentes archivadas",
        ],
      },
      request: {
        title: "¿Conservas un informe primario o una cita de la historia de HELP Math?",
        body:
          "Investigadores y antiguos colaboradores pueden enviar datos bibliográficos o una copia autorizada. No envíes registros individuales de estudiantes ni materiales que no tengas permiso para compartir.",
        action: { label: "Contactar con el archivo de investigación", href: "/es/contact?topic=research" },
      },
    },
    resources: {
      metadata: {
        title: "Recursos",
        description:
          "Encuentra recursos revisados del programa, investigación y modernización de HELP Math, o solicita al equipo una copia accesible.",
      },
      hero: {
        eyebrow: "Biblioteca de recursos",
        title: "Materiales del proyecto con su contexto incluido",
        summary:
          "El archivo contiene documentos útiles de programa y planificación, pero no todos están autorizados ni son accesibles para descarga pública. Cada elemento indica qué es y cómo debe —y no debe— interpretarse.",
        primaryAction: { label: "Solicitar un recurso", href: "/es/contact?topic=resources" },
        secondaryAction: { label: "Ver el contexto de investigación", href: "/es/research" },
      },
      archiveNotice: {
        title: "La publicación accesible está en curso",
        body:
          "Se están revisando la titularidad, el contenido sensible, los metadatos, el orden de lectura, los encabezados y las descripciones de imágenes de los PDF originales. Hasta completar la revisión, solicita acceso al equipo del proyecto.",
      },
      filters: {
        ariaLabel: "Filtrar recursos por categoría",
        all: "Todos los recursos",
        program: "Programa",
        research: "Investigación",
        technical: "Modernización",
      },
      items: [
        {
          id: "about-help-math",
          title: "About HELP Math",
          format: "PDF archivado · Programa",
          dateLabel: "Creado en 2014",
          status: "request",
          statusLabel: "Disponible previa solicitud",
          description:
            "Resumen histórico de los estudiantes previstos, diseño didáctico, descripciones curriculares y narrativa de evidencia. Las cifras y afirmaciones corresponden a un estado anterior del producto.",
          action: { label: "Solicitar este documento", href: "/es/contact?topic=resource-about-help-math" },
        },
        {
          id: "html5-phase-one",
          title: "HELP Math with HTML5: Phase I",
          format: "PDF archivado · Modernización",
          dateLabel: "Creado en 2020",
          status: "review",
          statusLabel: "Revisión de accesibilidad",
          description:
            "Propuesta histórica de actualización tecnológica basada en conceptos de aprendizaje multimedia e instrucción protegida. El trabajo propuesto no debe interpretarse como funcionalidad completada.",
          action: { label: "Consultar sobre esta propuesta", href: "/es/contact?topic=resource-html5-proposal" },
        },
        {
          id: "help-math-two-scope",
          title: "HELP Math 2.0 Scope",
          format: "PDF archivado · Programa",
          dateLabel: "Creado en 2020",
          status: "request",
          statusLabel: "Disponible previa solicitud",
          description:
            "Documento de planificación para ampliar contenido, diagnóstico, apoyos y capacidades de plataforma. Representa un alcance propuesto, no las funciones actuales de este sitio.",
          action: { label: "Solicitar este documento", href: "/es/contact?topic=resource-help-math-2-scope" },
        },
        {
          id: "modernization-notes",
          title: "Notas de modernización y recuperación",
          format: "Recurso web · Modernización",
          dateLabel: "Documentación viva del proyecto",
          status: "available",
          statusLabel: "Disponible previa solicitud",
          description:
            "Resumen de preservación de fuentes, recuperación de objetos de aprendizaje, validación, accesibilidad y planificación escalonada del producto.",
          action: { label: "Solicitar las notas actuales", href: "/es/contact?topic=modernization-notes" },
        },
      ],
      accessibleCopies: {
        title: "¿Necesitas otro formato?",
        body:
          "Indica qué recurso necesitas y qué formato lo haría utilizable. Responderemos con lo que esté disponible; no podemos garantizar la conversión inmediata de todos los archivos.",
        action: { label: "Solicitar una copia accesible", href: "/es/contact?topic=accessible-resource" },
      },
    },
    support: {
      metadata: {
        title: "Asistencia",
        description:
          "Consulta el estado actual de HELP Math, respuestas para usuarios que regresan, ayuda con demostraciones y una vía segura de contacto.",
      },
      hero: {
        eyebrow: "Asistencia de HELP Math",
        title: "Comienza por lo que está disponible hoy",
        summary:
          "El sitio moderno ofrece información del proyecto y demostraciones públicas en JavaScript. Las cuentas anteriores de estudiantes y educadores no se han reactivado, y este sitio no puede recuperar contraseñas ni registros de aprendizaje antiguos.",
        primaryAction: { label: "Contactar con asistencia", href: "/es/contact?topic=support" },
        secondaryAction: { label: "Comprobar el estado de acceso", href: "/es/login" },
      },
      currentStatus: {
        eyebrow: "Estado actual del servicio",
        title: "Lo que puedes utilizar ahora",
        items: [
          {
            id: "website",
            title: "Sitio web público",
            description:
              "Disponible en inglés y español con información del programa, enfoque, currículo, investigación y asistencia.",
            detail: "Disponible",
          },
          {
            id: "demos",
            title: "Demostraciones JavaScript",
            description:
              "Algunas actividades restauradas funcionan en un navegador moderno sin Flash ni cuenta estudiantil.",
            detail: "Versión preliminar pública",
          },
          {
            id: "accounts",
            title: "Cuentas de estudiantes y educadores",
            description:
              "El sitio moderno no ofrece acceso, clases, tareas, compras ni informes de progreso.",
            detail: "No disponible",
          },
        ],
      },
      faqLabel: "Preguntas frecuentes",
      faqs: [
        {
          id: "old-login",
          question: "¿Puedo usar mi antiguo usuario y contraseña de HELP Math?",
          answer:
            "No. El sitio público moderno no está conectado al antiguo sistema de cuentas. No introduzcas ni envíes una contraseña anterior. Un adulto puede contactar con asistencia indicando la organización y un contexto no sensible.",
        },
        {
          id: "flash",
          question: "¿Necesito Flash o un complemento especial?",
          answer:
            "No. Las actividades públicas son demostraciones modernas en JavaScript. Los archivos Flash originales se conservan de forma privada como evidencia de restauración y no son necesarios para visitantes.",
        },
        {
          id: "full-course",
          question: "¿Está disponible el curso completo de HELP Math?",
          answer:
            "Todavía no. La versión actual incluye información del proyecto y demostraciones seleccionadas. La disponibilidad curricular solo se describirá después de revisar fuentes, derechos, instrucción y accesibilidad.",
        },
        {
          id: "student-help",
          question: "Soy estudiante. ¿Cómo debo pedir ayuda?",
          answer:
            "Pide a un docente, madre, padre, tutor u otro adulto de confianza que contacte con el proyecto. Nunca envíes contraseñas, fechas de nacimiento, identificadores, calificaciones ni expedientes de clase.",
        },
        {
          id: "purchase",
          question: "¿Puede mi escuela comprar HELP Math en este sitio?",
          answer:
            "No. Las compras en línea y los precios públicos no forman parte de este lanzamiento. Un representante autorizado puede contactar con el proyecto para hablar de acceso o colaboración futura.",
        },
        {
          id: "demo-problem",
          question: "¿Qué incluyo al informar de un problema en una demostración?",
          answer:
            "Indica el nombre, la dirección de la página, el dispositivo y navegador, lo que esperabas y lo que ocurrió. Puede ayudar una captura sin información personal. No incluyas trabajo estudiantil ni credenciales.",
        },
      ],
      contact: {
        title: "¿Todavía necesitas ayuda?",
        body:
          "Envía una solicitud breve de un adulto. Usaremos el correo proporcionado únicamente para responder y gestionar la solicitud según el aviso de privacidad.",
        action: { label: "Abrir el formulario", href: "/es/contact?topic=support" },
      },
    },
    login: {
      metadata: {
        title: "Estado del acceso a cuentas",
        description:
          "Descubre por qué las antiguas cuentas de HELP Math no funcionan en el sitio moderno y encuentra la vía de asistencia adecuada.",
      },
      hero: {
        eyebrow: "Acceso a cuentas",
        title: "El antiguo acceso de HELP Math no está activo aquí",
        summary:
          "Este sitio es una versión preliminar pública de la modernización. No tiene formulario de acceso para estudiantes o educadores ni está conectado con la base de datos histórica.",
        primaryAction: { label: "Consultar sobre una cuenta", href: "/es/contact?topic=account-access" },
        secondaryAction: { label: "Usar las demostraciones públicas", href: "/es/demos" },
      },
      alert: {
        title: "Protege tus credenciales antiguas",
        body:
          "No envíes usuario, contraseña, identificador estudiantil, calificaciones ni lista de clase. El equipo no puede verificar ni restablecer una contraseña anterior mediante este sitio.",
      },
      options: {
        eyebrow: "Elige el siguiente paso",
        title: "Aún puedes explorar o pedir ayuda",
        cards: [
          {
            id: "student",
            title: "Soy estudiante",
            description:
              "Usa las demostraciones públicas sin iniciar sesión. Pide a un adulto de confianza que contacte por una cuenta antigua.",
            action: { label: "Explorar demostraciones", href: "/es/demos" },
          },
          {
            id: "educator",
            title: "Soy educador o representante escolar",
            description:
              "Contacta desde tu correo de trabajo e indica la organización. Describe el tipo de acceso o información histórica que necesitas sin compartir datos de estudiantes.",
            action: { label: "Solicitar asistencia", href: "/es/contact?topic=account-access" },
          },
          {
            id: "family",
            title: "Soy madre, padre o tutor",
            description:
              "Indica la escuela u organización vinculada con el programa anterior y cómo podemos ayudar. No incluyas contraseñas ni expedientes.",
            action: { label: "Contactar con el proyecto", href: "/es/contact?topic=family-support" },
          },
        ],
      },
      safetyNote:
        "Si otro sitio pide tu antigua contraseña de HELP Math, detente y confirma la dirección web con un adulto de confianza o con tu escuela. El sitio público oficial no pide iniciar sesión.",
    },
    contact: {
      metadata: {
        title: "Contactar con HELP Math",
        description:
          "Envía una solicitud de asistencia, recursos, investigación, acceso o colaboración de un adulto sin compartir expedientes ni credenciales.",
      },
      hero: {
        eyebrow: "Contactar con el proyecto",
        title: "Cuéntanos qué estás buscando",
        summary:
          "Usa este formulario para asistencia, preguntas históricas, recursos, investigación, comentarios de accesibilidad o colaboración futura. No es un servicio estudiantil ni un canal seguro para expedientes educativos.",
      },
      responseNote: {
        title: "Un equipo pequeño revisa cada solicitud",
        body:
          "Revisamos los mensajes legítimos según lo permita la capacidad del proyecto. Enviar el formulario no crea una cuenta, compra, acuerdo de servicio ni garantiza acceso o respuesta en una fecha concreta.",
      },
      form: {
        title: "Enviar un mensaje",
        intro: "Los campos obligatorios deben completarse antes de enviar el mensaje.",
        fields: {
          role: "Tu función",
          name: "Nombre",
          email: "Correo electrónico",
          organization: "Escuela u organización",
          topic: "Tema",
          message: "¿Cómo podemos ayudarte?",
          privacyConsent:
            "He leído el aviso de privacidad y entiendo que este formulario no debe incluir expedientes estudiantiles, contraseñas ni otra información personal sensible.",
        },
        placeholders: {
          name: "Tu nombre",
          email: "tu@ejemplo.org",
          organization: "Opcional",
          message:
            "Describe la solicitud sin incluir nombres, calificaciones, identificadores, contraseñas, fechas de nacimiento ni expedientes de estudiantes.",
        },
        roleOptions: [
          { value: "educator", label: "Educador" },
          { value: "school-representative", label: "Representante de una escuela u organización" },
          { value: "parent-guardian", label: "Madre, padre o tutor" },
          { value: "researcher", label: "Investigador" },
          { value: "former-partner", label: "Antiguo colaborador" },
          { value: "other-adult", label: "Otro adulto" },
        ],
        topicOptions: [
          { value: "support", label: "Asistencia con el sitio o una demostración" },
          { value: "account-access", label: "Consulta sobre una cuenta histórica" },
          { value: "curriculum", label: "Información curricular" },
          { value: "resources", label: "Solicitud de recursos" },
          { value: "research", label: "Investigación o evidencia" },
          { value: "accessibility", label: "Comentarios de accesibilidad" },
          { value: "collaboration", label: "Acceso o colaboración futura" },
          { value: "project-history", label: "Historia del proyecto" },
        ],
        submitLabel: "Enviar mensaje",
        submittingLabel: "Enviando…",
        successTitle: "Tu mensaje fue enviado",
        successMessage:
          "Gracias. El equipo de HELP Math revisará tu solicitud y responderá al correo proporcionado cuando corresponda.",
        errorTitle: "No se pudo enviar el mensaje",
        errorMessage:
          "No se ha enviado nada. Revisa los campos indicados e inténtalo de nuevo. Si continúa el problema, espera y vuelve a intentarlo más tarde.",
        validation: {
          required: "Completa este campo obligatorio.",
          invalidEmail: "Escribe un correo electrónico válido.",
          consentRequired: "Confirma la declaración de privacidad antes de enviar.",
          messageTooLong: "Limita el mensaje a 2.000 caracteres.",
        },
      },
      privacyWarning: {
        title: "No envíes datos estudiantiles ni secretos de cuenta",
        body:
          "No incluyas calificaciones, respuestas de evaluación, discapacidad, fechas de nacimiento, identificadores, listas de clase, usuarios, contraseñas ni otros expedientes educativos. Si una solicitud requiere información protegida, un representante autorizado debe acordar primero un proceso seguro aprobado.",
      },
      studentNote:
        "Estudiantes: pidan a un docente, madre, padre, tutor u otro adulto de confianza que se comunique por ustedes.",
    },
    demos: {
      metadata: {
        title: "Demostraciones JavaScript",
        description:
          "Explora restauraciones nativas del navegador en fase de revisión de objetos de aprendizaje HELP Math sin Flash, inicio de sesión ni recopilación de datos estudiantiles.",
      },
      hero: {
        eyebrow: "Demostraciones restauradas",
        title: "Pequeños objetos de aprendizaje, reconstruidos con cuidado",
        summary:
          "Cada demostración traduce una interacción histórica a JavaScript moderno y conserva la secuencia didáctica, el lenguaje visible, el ritmo y la repetición respaldados por las fuentes disponibles.",
        primaryAction: { label: "Abrir la primera demostración", href: "/es/demos/conversion-1-2" },
        secondaryAction: { label: "Cómo funciona la restauración", href: "/es/about#preservation" },
      },
      previewNotice: {
        title: "Son versiones preliminares, no el curso completo de HELP Math",
        body:
          "Las demostraciones no incluyen matrícula, ubicación, tareas, calificación ni registros de progreso. No recopilan respuestas o trabajo estudiantil y no deben usarse como evaluación diagnóstica.",
      },
      listLabel: "Demostraciones disponibles",
      items: [
        {
          id: "conversion-1-2",
          title: "Conversión 1.2",
          summary:
            "Reconstrucción sincronizada por fotogramas que coordina etiquetas matemáticas, cambio visual y una secuencia explicativa repetible.",
          conceptLabel: "Enfoque de restauración",
          concept: "Fidelidad de secuencia, diseño, texto y repetición",
          statusLabel: "Vista preliminar en revisión condicional",
          statusDetail: "Disponible sin iniciar sesión",
          action: { label: "Iniciar Conversión 1.2", href: "/es/demos/conversion-1-2" },
        },
        {
          id: "conversion-1-4",
          title: "Conversión 1.4",
          summary:
            "Una segunda secuencia restaurada que muestra cómo la animación nativa puede conservar el ritmo y las relaciones explicativas.",
          conceptLabel: "Enfoque de restauración",
          concept: "Animación vectorial adaptable y repetición",
          statusLabel: "Vista preliminar en revisión condicional",
          statusDetail: "Disponible sin iniciar sesión",
          action: { label: "Iniciar Conversión 1.4", href: "/es/demos/conversion-1-4" },
        },
      ],
      quality: {
        id: "quality",
        eyebrow: "Antes de publicar una demostración",
        title: "Fuentes, comprobaciones de comportamiento y revisión visual",
        paragraphs: [
          "Cada restauración se revisa frente a las fuentes de autoría y ejecución disponibles. El equipo registra el escenario original, la secuencia, los estados visibles, las interacciones y las excepciones conocidas en lugar de tratar una reproducción aproximada como prueba de fidelidad.",
        ],
        bullets: [
          "Captura determinista de fotogramas clave y comparación visual",
          "Comprobaciones de repetición y teclado",
          "Revisión de diseño adaptable, desbordamiento de texto y movimiento reducido",
          "Comprobaciones de consola, recursos y red",
          "Registro escrito de toda diferencia pendiente",
        ],
      },
      accessibility: {
        title: "¿Necesitas ayuda para usar una demostración?",
        body:
          "Indica la demostración, navegador, dispositivo e interacción que presentó dificultades. No incluyas trabajo estudiantil ni expedientes personales.",
        action: { label: "Enviar comentarios de accesibilidad", href: "/es/contact?topic=accessibility" },
      },
    },
    demoDetails: {
      "conversion-1-2": {
        metadata: {
          title: "Demostración Conversión 1.2",
          description:
            "Ejecuta la restauración JavaScript Conversión 1.2 en fase de revisión, consulta las indicaciones y conoce los límites de esta versión preliminar.",
        },
        eyebrow: "Objeto de aprendizaje restaurado",
        title: "Conversión 1.2",
        summary:
          "Esta reconstrucción nativa del navegador conserva una secuencia explicativa breve del archivo HELP Math mediante tiempos por fotogramas, gráficos vectoriales escalables y repetición determinista.",
        statusLabel: "Vista preliminar en revisión condicional",
        statusDetail: "Validación incompleta · Sin inicio de sesión · Sin recopilación de datos estudiantiles",
        instructionsTitle: "Antes de comenzar",
        instructions: [
          "Observa cómo las etiquetas y los elementos visuales cambian juntos durante la secuencia.",
          "Usa Repetir para volver al primer fotograma y ejecutar la misma secuencia.",
          "Con teclado, mueve el foco al control Repetir y actívalo con Intro o la barra espaciadora.",
        ],
        playerLabel: "Demostración interactiva Conversión 1.2",
        loadingLabel: "Cargando la demostración…",
        unavailableTitle: "No se pudo cargar la demostración",
        unavailableMessage:
          "Actualiza la página una vez. Si sigue sin cargar, informa del navegador, dispositivo y dirección a través de asistencia.",
        replayLabel: "Repetir demostración",
        restartLabel: "Reiniciar desde el principio",
        pauseLabel: "Pausar animación",
        playLabel: "Reproducir animación",
        reducedMotionNote:
          "Si está activado el movimiento reducido, la experiencia puede limitar el movimiento automático y mantener disponibles los estados didácticos.",
        accessibilityTitle: "Notas de acceso",
        accessibilityNotes: [
          "La actividad se adapta dentro de la página y conserva las proporciones del escenario original.",
          "Los controles visibles admiten foco y activación mediante teclado.",
          "El texto importante forma parte de la experiencia moderna y no de una superficie de complemento.",
        ],
        disclaimerTitle: "Límites de la demostración",
        disclaimer:
          "Es un objeto de aprendizaje restaurado, no una lección, curso, evaluación ni afirmación actual de eficacia. No guarda respuestas, puntuaciones ni progreso. El material Flash original se conserva de forma privada como evidencia y no se sirve a visitantes.",
        backAction: { label: "Volver a todas las demostraciones", href: "/es/demos" },
        supportAction: { label: "Informar de un problema", href: "/es/contact?topic=support" },
      },
      "conversion-1-4": {
        metadata: {
          title: "Demostración Conversión 1.4",
          description:
            "Ejecuta la restauración JavaScript Conversión 1.4, consulta las indicaciones y conoce los límites de esta versión preliminar.",
        },
        eyebrow: "Objeto de aprendizaje restaurado",
        title: "Conversión 1.4",
        summary:
          "Este segundo ejemplo nativo del navegador muestra cómo el proyecto traduce movimiento didáctico, etiquetas y tiempos a JavaScript sostenible.",
        statusLabel: "Vista preliminar en revisión condicional",
        statusDetail: "Validación incompleta · Sin inicio de sesión · Sin recopilación de datos estudiantiles",
        instructionsTitle: "Antes de comenzar",
        instructions: [
          "Sigue la secuencia desde el estado inicial hasta el estado explicativo final.",
          "Usa Repetir para reiniciar la actividad cuando termine.",
          "Con teclado, mueve el foco al control Repetir y actívalo con Intro o la barra espaciadora.",
        ],
        playerLabel: "Demostración interactiva Conversión 1.4",
        loadingLabel: "Cargando la demostración…",
        unavailableTitle: "No se pudo cargar la demostración",
        unavailableMessage:
          "Actualiza la página una vez. Si sigue sin cargar, informa del navegador, dispositivo y dirección a través de asistencia.",
        replayLabel: "Repetir demostración",
        restartLabel: "Reiniciar desde el principio",
        pauseLabel: "Pausar animación",
        playLabel: "Reproducir animación",
        reducedMotionNote:
          "Si está activado el movimiento reducido, la experiencia puede limitar el movimiento automático y mantener disponibles los estados didácticos.",
        accessibilityTitle: "Notas de acceso",
        accessibilityNotes: [
          "La actividad mantiene sus proporciones previstas en distintos tamaños de página.",
          "Los controles visibles admiten foco y activación mediante teclado.",
          "El texto y los controles los presenta la página moderna, no un complemento obsoleto.",
        ],
        disclaimerTitle: "Límites de la demostración",
        disclaimer:
          "Es un objeto de aprendizaje restaurado, no una lección, curso, evaluación ni afirmación actual de eficacia. No guarda respuestas, puntuaciones ni progreso. El material Flash original se conserva de forma privada como evidencia y no se sirve a visitantes.",
        backAction: { label: "Volver a todas las demostraciones", href: "/es/demos" },
        supportAction: { label: "Informar de un problema", href: "/es/contact?topic=support" },
      },
    },
    privacy: {
      metadata: {
        title: "Aviso de privacidad",
        description:
          "Conoce qué recopila el sitio público HELP Math, para qué se usa la información de contacto y por qué no deben enviarse expedientes estudiantiles.",
      },
      hero: {
        eyebrow: "Aviso de privacidad",
        title: "Una versión pública diseñada para recopilar menos",
        summary:
          "El sitio ofrece información y demostraciones sin cuentas ni almacenamiento de datos de aprendizaje. Este aviso explica los datos limitados utilizados para operar el sitio y responder solicitudes de adultos.",
      },
      effectiveDateLabel: "Última actualización",
      effectiveDate: "21 de julio de 2026",
      reviewNotice:
        "Requiere revisión del titular antes de publicarse. Este borrador refleja la configuración prevista y debe actualizarse si cambian proveedores, flujos de datos o servicios.",
      sections: [
        {
          id: "scope",
          title: "1. Alcance",
          paragraphs: [
            "Este aviso se aplica al sitio público HELP Math en helpmath.ai, incluidas sus páginas informativas, demostraciones y formulario de contacto.",
            "No describe una plataforma estudiantil, porque este lanzamiento no incluye cuentas, clases, tareas, compras ni almacenamiento de progreso.",
          ],
        },
        {
          id: "information",
          title: "2. Información que procesamos",
          paragraphs: [
            "Puedes navegar por el contenido público y usar las demostraciones sin dar tu nombre ni crear una cuenta.",
          ],
          bullets: [
            "La información y el mensaje que decidas enviar: función, nombre, correo, organización, tema y contenido.",
            "Información técnica limitada que procesan nuestros servicios de alojamiento, seguridad y rendimiento, como hora, página, navegador o dispositivo, ubicación aproximada de red y dirección IP.",
            "Señales contra el abuso necesarias para proteger el formulario frente a envíos automatizados.",
          ],
        },
        {
          id: "use",
          title: "3. Cómo utilizamos la información",
          paragraphs: [
            "Usamos la información enviada y técnica para operar y proteger el sitio, responder solicitudes, resolver errores, comprender el rendimiento agregado y mantener registros apropiados de correspondencia.",
            "No usamos el formulario público para crear perfiles de aprendizaje, calificar trabajo estudiantil ni tomar decisiones educativas automatizadas.",
          ],
        },
        {
          id: "student-data",
          title: "4. Información estudiantil y sensible",
          paragraphs: [
            "No envíes nombres, calificaciones, respuestas de evaluaciones, discapacidad, fechas de nacimiento, identificadores, listas de clase, usuarios, contraseñas ni otros expedientes educativos. El formulario no es un canal seguro aprobado para ello.",
            "Los estudiantes deben pedir a un adulto de confianza que contacte con el proyecto. Si alguna vez se requiere información protegida, una organización autorizada debe acordar previamente un proceso independiente y revisado.",
          ],
        },
        {
          id: "sharing",
          title: "5. Proveedores y divulgación",
          paragraphs: [
            "Prevemos usar Vercel para alojar y supervisar el sitio, Cloudflare Turnstile para reducir abuso y Resend para entregar mensajes. Estos proveedores pueden procesar información limitada en nuestro nombre bajo sus propios términos contractuales y de privacidad.",
            "No vendemos información personal. Podemos divulgarla cuando sea necesario para prestar asistencia, proteger el sitio o a las personas, cumplir la ley o completar una transición organizativa con salvaguardas adecuadas.",
          ],
        },
        {
          id: "retention",
          title: "6. Conservación y seguridad",
          paragraphs: [
            "Conservamos los mensajes solo durante el tiempo razonablemente necesario para responder, mantener registros, resolver disputas y cumplir obligaciones legales u operativas. Los registros de alojamiento y seguridad siguen los periodos configurados de los servicios.",
            "Aplicamos salvaguardas administrativas y técnicas razonables, pero ningún correo, formulario o transmisión por internet puede garantizarse como totalmente seguro. Por eso tampoco deben enviarse expedientes sensibles.",
          ],
        },
        {
          id: "choices",
          title: "7. Tus opciones",
          paragraphs: [
            "Puedes navegar sin usar el formulario. También puedes preguntar por acceso, corrección o eliminación de información que hayas enviado. Responderemos según la legislación aplicable y quizá debamos verificar la solicitud.",
          ],
        },
        {
          id: "international",
          title: "8. Visitantes internacionales",
          paragraphs: [
            "Nuestros proveedores pueden procesar información en Estados Unidos y otros lugares. Los derechos y requisitos de transferencia varían por ubicación; contáctanos si tienes una pregunta regional.",
          ],
        },
        {
          id: "changes",
          title: "9. Cambios en este aviso",
          paragraphs: [
            "Actualizaremos la fecha y el contenido antes de introducir prácticas de datos sustancialmente distintas, como cuentas, analítica educativa, pagos o un nuevo sistema de contacto.",
          ],
        },
      ],
      contact: {
        title: "¿Tienes una pregunta o solicitud de privacidad?",
        body:
          "Usa el formulario y elige comentarios de accesibilidad u otro tema pertinente. No incluyas expedientes sensibles.",
        action: { label: "Contactar con el proyecto", href: "/es/contact?topic=privacy" },
      },
    },
    terms: {
      metadata: {
        title: "Términos de uso",
        description:
          "Consulta los términos de uso del sitio público HELP Math, su contenido informativo, contexto histórico y demostraciones JavaScript.",
      },
      hero: {
        eyebrow: "Términos de uso",
        title: "Utiliza responsablemente la versión preliminar pública",
        summary:
          "Estos términos cubren el sitio informativo y las demostraciones públicas. No crean una cuenta, suscripción escolar, compra, licencia de materiales históricos ni garantía de acceso futuro.",
      },
      effectiveDateLabel: "Última actualización",
      effectiveDate: "21 de julio de 2026",
      reviewNotice:
        "Requiere revisión del titular y asesoría legal antes de publicarse. La entidad responsable, jurisdicción, dirección de contacto y posibles licencias de demostraciones deben confirmarse para producción.",
      sections: [
        {
          id: "acceptance",
          title: "1. Aceptación y requisitos",
          paragraphs: [
            "Al usar el sitio, aceptas estos términos y el aviso de privacidad. Si no estás de acuerdo, no utilices el sitio.",
            "El formulario está dirigido a adultos. Los estudiantes deben usar el contenido público con la orientación apropiada y pedir a un adulto de confianza que envíe solicitudes.",
          ],
        },
        {
          id: "service",
          title: "2. Qué ofrece este sitio",
          paragraphs: [
            "El sitio ofrece información del proyecto, contexto histórico, asistencia y demostraciones seleccionadas durante una modernización activa.",
            "Actualmente no ofrece matrículas, cuentas, clases, tareas, evaluación, informes de progreso, pagos ni acceso garantizado al programa histórico.",
          ],
        },
        {
          id: "acceptable-use",
          title: "3. Uso aceptable",
          paragraphs: [
            "Puedes acceder a las páginas y demostraciones públicas para evaluación personal, revisión docente y referencia educativa ordinaria, sujeto a estos términos y a los avisos de cada recurso.",
          ],
          bullets: [
            "No interfieras con el sitio, eludas medidas de seguridad o acceso ni sobrecargues los servicios.",
            "No uses sistemas automatizados para extraer, copiar o redistribuir a gran escala el archivo o las demostraciones sin permiso escrito.",
            "No cargues código malicioso, suplantes a otra persona ni uses el formulario para correo basura o actividades ilícitas.",
            "No envíes expedientes estudiantiles, contraseñas ni otra información sensible.",
          ],
        },
        {
          id: "intellectual-property",
          title: "4. Propiedad intelectual y material histórico",
          paragraphs: [
            "El sitio, nombre del proyecto, demostraciones, textos, imágenes, fuentes y otros contenidos pueden estar protegidos por derechos de autor, marcas, contratos u otros derechos. El acceso público no transfiere titularidad ni concede derecho a republicar, vender, modificar, extraer o crear un archivo competidor.",
            "Los nombres y materiales históricos pueden reflejar derechos de sus respectivos titulares. Contacta con el proyecto antes de un uso que exceda la visualización ordinaria o la evaluación docente.",
          ],
        },
        {
          id: "educational-use",
          title: "5. Contexto educativo",
          paragraphs: [
            "Las demostraciones son ejemplos de interacciones didácticas restauradas, no un currículo completo, instrumento diagnóstico, intervención individualizada ni sustituto del criterio docente.",
            "Las descripciones históricas de investigación, premios, alineación, alcance o funciones se identifican como contexto archivado salvo que el sitio afirme expresamente una verificación actual.",
          ],
        },
        {
          id: "availability",
          title: "6. Disponibilidad y cambios",
          paragraphs: [
            "El proyecto puede añadir, revisar, pausar o retirar contenido mientras se revisan fuentes, derechos, precisión, seguridad y accesibilidad. No prometemos que un recurso, cuenta o función histórica esté disponible en el futuro.",
          ],
        },
        {
          id: "links",
          title: "7. Servicios y enlaces de terceros",
          paragraphs: [
            "El sitio puede depender de servicios de terceros o enlazarlos. Sus términos y prácticas se aplican a sus servicios, y un enlace no significa que HELP Math respalde todo su contenido.",
          ],
        },
        {
          id: "disclaimer",
          title: "8. Descargos y responsabilidad",
          paragraphs: [
            "En la medida permitida por la ley, la versión preliminar se ofrece según disponibilidad, sin prometer funcionamiento ininterrumpido, ausencia de errores, integridad o idoneidad para una decisión didáctica. Nada limita derechos u obligaciones que legalmente no puedan limitarse.",
            "Eres responsable de utilizar el sitio de forma lícita, adecuada a la edad y coherente con las políticas de tu escuela u organización.",
          ],
        },
        {
          id: "changes",
          title: "9. Cambios en estos términos",
          paragraphs: [
            "Podemos actualizar los términos al cambiar el proyecto. La fecha aparecerá arriba. Servicios sustancialmente distintos —cuentas, suscripciones, pagos o datos estudiantiles— requerirán términos y privacidad revisados antes de lanzarse.",
          ],
        },
      ],
      contact: {
        title: "¿Tienes dudas sobre un uso permitido?",
        body:
          "Contacta con el proyecto antes de copiar, publicar, licenciar o distribuir materiales de HELP Math más allá del uso normal del sitio público.",
        action: { label: "Consultar sobre uso o permisos", href: "/es/contact?topic=permissions" },
      },
    },
  },
} satisfies SiteContent;
