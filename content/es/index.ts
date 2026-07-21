import type { SiteContent } from "../types";

export const esContent = {
  locale: "es",
  shared: {
    siteName: "HELP Math",
    siteTagline: "El lenguaje matemático, a la vista",
    skipToContent: "Ir al contenido principal",
    statusLabel: "Modernización en curso",
    statusMessage:
      "HELP Math se moderniza cuidadosamente para la web actual. La información del proyecto está disponible; las demostraciones, el contacto y las cuentas aún no son públicos.",
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
        { label: "Estado de demostraciones", href: "/es/demos" },
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
          "Conoce el proyecto moderno HELP Math: apoyo matemático bilingüe, contexto de investigación, estado de modernización y ayuda para quienes regresan.",
      },
      hero: {
        eyebrow: "Bienvenidos de nuevo a HELP Math",
        title: "Descubre el lenguaje dentro de cada idea matemática.",
        summary:
          "HELP Math conecta modelos visuales, explicaciones claras, vocabulario académico y práctica guiada para que los estudiantes multilingües comprendan tanto las matemáticas como las palabras que se usan para describirlas.",
        primaryAction: { label: "Comprobar estado de demostraciones", href: "/es/demos" },
        secondaryAction: { label: "Obtener ayuda con el proyecto", href: "/es/support" },
        supportingNote:
          "El nuevo sitio informativo es una versión preliminar pública. Los prototipos JavaScript siguen privados mientras estén incompletas la validación y la revisión de derechos.",
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
          "Cada estudiante puede necesitar un punto de entrada distinto. El sitio público actual explica cómo HELP Math relacionaba históricamente explicación, lenguaje y representaciones de apoyo.",
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
              "Examina el enfoque didáctico archivado y las puertas de evidencia para una modernización futura responsable.",
          },
        ],
      },
      approach: {
        eyebrow: "Cómo enseña HELP Math",
        title: "Las palabras, las representaciones y el razonamiento trabajan juntos",
        intro:
          "El programa histórico combinaba matemáticas y apoyos lingüísticos. La modernización documenta esa idea mientras las nuevas implementaciones siguen en revisión.",
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
        eyebrow: "Estado de publicación de demostraciones",
        title: "Los prototipos siguen privados hasta completar evidencia y derechos",
        intro:
          "Dos prototipos de reconstrucción nativos del navegador se conservan en el repositorio privado. Sus rutas públicas e imágenes extraídas están cerradas en esta versión.",
        items: [],
        note:
          "La publicación exige derechos escritos y evidencia de línea base, fotogramas clave, comportamiento, diferencias visuales, accesibilidad y aceptación técnica. Ningún prototipo actual ha superado esa puerta.",
      },
      closing: {
        title: "¿Regresas a HELP Math? Queremos orientarte.",
        body:
          "La página de estado de contacto indica si se aceptan solicitudes de adultos. Nunca envíes expedientes estudiantiles ni contraseñas por otro canal.",
        action: { label: "Comprobar disponibilidad de contacto", href: "/es/contact" },
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
            "El proceso de migración trata esos archivos como evidencia. Debe verificar explicaciones, ritmo, apoyos lingüísticos e interacciones antes de afirmar que una nueva implementación los conserva.",
          ],
        },
        {
          id: "today",
          eyebrow: "Nuestra situación actual",
          title: "Una fase de sitio informativo y prototipos privados",
          paragraphs: [
            "Esta versión presenta el proyecto y facilita la revisión de contexto histórico seleccionado. Los prototipos JavaScript y recursos extraídos siguen privados mientras estén abiertas la validación y las decisiones de derechos.",
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
        action: { label: "Comprobar estado de contacto", href: "/es/contact?topic=project-history" },
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
        primaryAction: { label: "Revisar estado de demostraciones", href: "/es/demos" },
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
          "Los patrones exactos variaban, pero las descripciones archivadas identifican un recorrido didáctico transparente.",
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
          "Cualquier demostración pública futura mostraría solo un objeto limitado, no un curso completo ni un sistema docente automatizado. Los educadores siguen siendo esenciales para elegir tareas y escuchar el razonamiento.",
        action: { label: "Comprobar disponibilidad de consultas", href: "/es/contact?topic=instruction" },
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
          "Los materiales históricos describen configuraciones de HELP Math para primaria superior y grados intermedios, además de usos de refuerzo. El sitio actual publica contexto y estado de demos, no el currículo ni prototipos de lecciones.",
        primaryAction: { label: "Revisar estado de demostraciones", href: "/es/demos" },
        secondaryAction: { label: "Comprobar solicitudes curriculares", href: "/es/contact?topic=curriculum" },
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
        title: "Cómo puede desarrollarse un patrón de lección archivado",
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
        title: "Información, no matrículas ni acceso a lecciones",
        paragraphs: [
          "El sitio moderno ofrece información y estado de publicación. No incluye demostraciones públicas, lecciones completas, pruebas de ubicación, paneles docentes, tareas ni almacenamiento de progreso.",
          "La futura publicación curricular depende de auditorías de fuentes y derechos, revisión didáctica, trabajo de accesibilidad y validación frente al comportamiento original.",
        ],
      },
      closing: {
        title: "¿Buscas una lección o un documento histórico de alcance?",
        body:
          "Comprueba si el contacto para adultos está abierto antes de preparar una solicitud. La disponibilidad también depende de revisar fuentes, derechos y accesibilidad.",
        action: { label: "Comprobar disponibilidad", href: "/es/contact?topic=curriculum" },
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
        primaryAction: { label: "Comprobar solicitudes de fuentes", href: "/es/contact?topic=research" },
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
          "Investigadores y antiguos colaboradores pueden comprobar si el contacto para adultos está abierto antes de preparar datos bibliográficos o una copia autorizada. No envíes registros de estudiantes ni materiales sin permiso.",
        action: { label: "Comprobar estado del archivo", href: "/es/contact?topic=research" },
      },
    },
    resources: {
      metadata: {
        title: "Recursos",
        description:
          "Encuentra contexto revisado del programa, investigación y modernización de HELP Math y consulta el estado de futuras solicitudes.",
      },
      hero: {
        eyebrow: "Biblioteca de recursos",
        title: "Materiales del proyecto con su contexto incluido",
        summary:
          "El archivo contiene documentos útiles de programa y planificación, pero no todos están autorizados ni son accesibles para descarga pública. Cada elemento indica qué es y cómo debe —y no debe— interpretarse.",
        primaryAction: { label: "Comprobar disponibilidad de recursos", href: "/es/contact?topic=resources" },
        secondaryAction: { label: "Ver el contexto de investigación", href: "/es/research" },
      },
      archiveNotice: {
        title: "La publicación accesible está en curso",
        body:
          "Se están revisando la titularidad, el contenido sensible, los metadatos, el orden de lectura, los encabezados y las descripciones de imágenes. El contacto y la disponibilidad de archivos se indican por separado y pueden seguir cerrados durante la revisión.",
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
          statusLabel: "Publicación pendiente",
          description:
            "Resumen histórico de los estudiantes previstos, diseño didáctico, descripciones curriculares y narrativa de evidencia. Las cifras y afirmaciones corresponden a un estado anterior del producto.",
          action: { label: "Comprobar disponibilidad", href: "/es/contact?topic=resource-about-help-math" },
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
          action: { label: "Comprobar consultas", href: "/es/contact?topic=resource-html5-proposal" },
        },
        {
          id: "help-math-two-scope",
          title: "HELP Math 2.0 Scope",
          format: "PDF archivado · Programa",
          dateLabel: "Creado en 2020",
          status: "request",
          statusLabel: "Publicación pendiente",
          description:
            "Documento de planificación para ampliar contenido, diagnóstico, apoyos y capacidades de plataforma. Representa un alcance propuesto, no las funciones actuales de este sitio.",
          action: { label: "Comprobar disponibilidad", href: "/es/contact?topic=resource-help-math-2-scope" },
        },
        {
          id: "modernization-notes",
          title: "Notas de modernización y recuperación",
          format: "Recurso web · Modernización",
          dateLabel: "Documentación viva del proyecto",
          status: "available",
          statusLabel: "Acceso pendiente",
          description:
            "Resumen de preservación de fuentes, recuperación de objetos de aprendizaje, validación, accesibilidad y planificación escalonada del producto.",
          action: { label: "Comprobar disponibilidad de notas", href: "/es/contact?topic=modernization-notes" },
        },
      ],
      accessibleCopies: {
        title: "¿Necesitas otro formato?",
        body:
          "Comprueba si el contacto para adultos está abierto antes de preparar el nombre del recurso y el formato necesario. No se garantiza la conversión inmediata de archivos.",
        action: { label: "Comprobar copias accesibles", href: "/es/contact?topic=accessible-resource" },
      },
    },
    support: {
      metadata: {
        title: "Asistencia",
        description:
          "Consulta el estado actual de HELP Math, respuestas para quienes regresan, estado de publicación de demostraciones y una vía segura de contacto.",
      },
      hero: {
        eyebrow: "Asistencia de HELP Math",
        title: "Comienza por lo que está disponible hoy",
        summary:
          "El sitio moderno ofrece información y estado de publicación. Los prototipos JavaScript, las cuentas anteriores y el contacto no son públicos, y este sitio no puede recuperar contraseñas ni registros antiguos.",
        primaryAction: { label: "Comprobar disponibilidad de asistencia", href: "/es/contact?topic=support" },
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
              "Los prototipos e imágenes extraídas siguen privados hasta documentar derechos y aceptación técnica.",
            detail: "No disponibles públicamente",
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
            "No. El sitio público moderno no está conectado al antiguo sistema de cuentas. No introduzcas ni envíes una contraseña anterior. Un adulto puede comprobar el estado de contacto usando solo la organización y contexto no sensible cuando se abra.",
        },
        {
          id: "flash",
          question: "¿Necesito Flash o un complemento especial?",
          answer:
            "No. Flash no es necesario para navegar por el sitio informativo. Los archivos Flash y prototipos JavaScript siguen siendo evidencia privada y no se sirven a visitantes.",
        },
        {
          id: "full-course",
          question: "¿Está disponible el curso completo de HELP Math?",
          answer:
            "Todavía no. La versión actual incluye información del proyecto, pero no demostraciones públicas. La disponibilidad curricular o de demos solo se describirá después de revisar fuentes, derechos, instrucción y accesibilidad.",
        },
        {
          id: "student-help",
          question: "Soy estudiante. ¿Cómo debo pedir ayuda?",
          answer:
            "Pide a un docente, madre, padre, tutor u otro adulto de confianza que compruebe la disponibilidad de contacto. Nunca envíes contraseñas, fechas de nacimiento, identificadores, calificaciones ni expedientes por un canal público.",
        },
        {
          id: "purchase",
          question: "¿Puede mi escuela comprar HELP Math en este sitio?",
          answer:
            "No. Las compras en línea y los precios públicos no forman parte de este lanzamiento. Un representante autorizado puede comprobar la disponibilidad de contacto para futuras preguntas de acceso o colaboración.",
        },
        {
          id: "demo-problem",
          question: "¿Qué incluyo en un futuro informe de problema de una demostración?",
          answer:
            "Si las demos se aprueban más adelante, indica nombre, dirección, dispositivo, navegador, lo esperado y lo ocurrido. Puede ayudar una captura sin datos personales. No incluyas trabajo estudiantil ni credenciales.",
        },
      ],
      contact: {
        title: "¿Todavía necesitas ayuda?",
        body:
          "La página de estado indica si se aceptan solicitudes de asistencia de adultos y qué información nunca debe enviarse.",
        action: { label: "Comprobar disponibilidad de contacto", href: "/es/contact?topic=support" },
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
        primaryAction: { label: "Comprobar asistencia de cuentas", href: "/es/contact?topic=account-access" },
        secondaryAction: { label: "Revisar estado de demostraciones", href: "/es/demos" },
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
              "Consulta la información pública sin iniciar sesión. Pide a un adulto de confianza que compruebe la disponibilidad de contacto por una cuenta antigua.",
            action: { label: "Revisar estado del proyecto", href: "/es/about" },
          },
          {
            id: "educator",
            title: "Soy educador o representante escolar",
            description:
              "Comprueba si el contacto está abierto. Si lo está, usa un correo de trabajo e indica la organización sin compartir datos de estudiantes.",
            action: { label: "Comprobar disponibilidad de asistencia", href: "/es/contact?topic=account-access" },
          },
          {
            id: "family",
            title: "Soy madre, padre o tutor",
            description:
              "Comprueba si el contacto está abierto antes de preparar el nombre de la escuela u organización. No incluyas contraseñas ni expedientes.",
            action: { label: "Comprobar disponibilidad de contacto", href: "/es/contact?topic=family-support" },
          },
        ],
      },
      safetyNote:
        "Si otro sitio pide tu antigua contraseña de HELP Math, detente y confirma la dirección web con un adulto de confianza o con tu escuela. El sitio público oficial no pide iniciar sesión.",
    },
    contact: {
      metadata: {
        title: "Disponibilidad de contacto de HELP Math",
        description:
          "Comprueba si HELP Math acepta solicitudes de adultos sobre asistencia, recursos, investigación, acceso o colaboración.",
      },
      hero: {
        eyebrow: "Disponibilidad de contacto",
        title: "Comprueba si las solicitudes están abiertas",
        summary:
          "Esta página muestra el estado de solicitudes de adultos sobre asistencia, historia, recursos, investigación, accesibilidad y colaboración. No es un servicio estudiantil ni un canal seguro para expedientes educativos.",
      },
      responseNote: {
        title: "El estado mostrado abajo es el vigente",
        body:
          "Cuando el contacto verificado esté abierto, un pequeño equipo revisará mensajes legítimos según su capacidad. Un mensaje no crea una cuenta, compra, acuerdo de servicio ni una fecha de respuesta garantizada.",
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
          privacyNoticeLinkLabel: "Abrir el aviso de privacidad",
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
          { value: "support", label: "Asistencia con el sitio o futuras demostraciones" },
          { value: "account-access", label: "Consulta sobre una cuenta histórica" },
          { value: "curriculum", label: "Información curricular" },
          { value: "resources", label: "Solicitud de recursos" },
          { value: "research", label: "Investigación o evidencia" },
          { value: "accessibility", label: "Comentarios de accesibilidad" },
          { value: "privacy", label: "Consulta sobre privacidad" },
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
        "Estudiantes: pidan a un docente, madre, padre, tutor u otro adulto de confianza que compruebe esta página por ustedes.",
    },
    demos: {
      metadata: {
        title: "Estado de las demostraciones",
        description:
          "Consulta el estado de publicación de los prototipos HELP Math mientras siguen pendientes la validación técnica y la revisión de derechos.",
      },
      hero: {
        eyebrow: "Revisión de demostraciones",
        title: "Las demostraciones siguen privadas mientras la revisión esté incompleta",
        summary:
          "Los prototipos JavaScript actuales se conservan en el repositorio privado. Ninguna demostración ni imagen extraída está disponible en este sitio público hasta documentar los derechos y aceptar la revisión técnica requerida.",
        primaryAction: { label: "Leer el enfoque de preservación", href: "/es/about#preservation" },
        secondaryAction: { label: "Ver el estado del proyecto", href: "/es/about" },
      },
      previewNotice: {
        title: "Actualmente no hay demostraciones públicas aprobadas",
        body:
          "La procedencia de las fuentes no demuestra por sí sola derechos de publicación ni fidelidad. Cada prototipo debe recibir aprobación escrita de derechos, completar la validación requerida y registrar la aceptación técnica antes de abrir su ruta y recursos extraídos.",
      },
      listLabel: "Demostraciones aprobadas",
      items: [],
      quality: {
        id: "quality",
        eyebrow: "Requisitos previos a la publicación",
        title: "Aprobación de derechos, fuentes, comportamiento y revisión visual",
        paragraphs: [
          "Ningún prototipo actual ha superado esta puerta. Una revisión futura debe compararlo con las fuentes de autoría y ejecución, registrar escenario, secuencia, estados, interacciones y excepciones, y nunca tratar una reproducción aproximada como prueba de fidelidad.",
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
        title: "¿Preguntas sobre futuras demostraciones accesibles?",
        body:
          "Comprueba si el contacto está abierto para preguntar por el proceso de revisión previsto. No incluyas trabajo estudiantil, expedientes personales ni fuentes que no estés autorizado a compartir.",
        action: { label: "Comprobar comentarios de accesibilidad", href: "/es/contact?topic=accessibility" },
      },
    },
    demoDetails: {
      "conversion-1-2": {
        metadata: {
          title: "Demostración Conversión 1.2",
          description:
            "Copia privada de revisión del prototipo de reconstrucción JavaScript Conversión 1.2 sin validar.",
        },
        eyebrow: "Prototipo de reconstrucción sin validar",
        title: "Conversión 1.2",
        summary:
          "Este prototipo nativo del navegador intenta reconstruir una secuencia archivada. Sus controles y fotogramas pueden revisarse de forma privada, pero la fidelidad no se ha establecido mediante las líneas base, fotogramas clave o pruebas RMSE requeridas.",
        statusLabel: "Prototipo de revisión privada",
        statusDetail: "Sin publicación pública · Validación incompleta · Derechos pendientes",
        instructionsTitle: "Antes de comenzar",
        instructions: [
          "Observa cómo las etiquetas y los elementos visuales cambian juntos durante la secuencia.",
          "Usa Reproducir o Pausar en cualquier momento, o Reiniciar para volver al primer fotograma.",
          "Usa el control de fotogramas con el puntero o las flechas del teclado para revisar cualquier estado sin movimiento automático.",
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
        frameLabel: "Fotograma de la animación",
        reducedMotionNote:
          "Si está activado el movimiento reducido, la experiencia puede limitar el movimiento automático y mantener disponibles los estados didácticos.",
        accessibilityTitle: "Notas de acceso",
        accessibilityNotes: [
          "La actividad usa las dimensiones de escenario registradas por la auditoría automática parcial.",
          "Los controles visibles admiten foco y activación mediante teclado.",
          "El texto importante forma parte de la experiencia moderna y no de una superficie de complemento.",
        ],
        disclaimerTitle: "Límites del prototipo",
        disclaimer:
          "Esta implementación privada no es una migración terminada ni fiel, una lección, curso, evaluación o afirmación actual de eficacia. No guarda respuestas, puntuaciones ni progreso. El material Flash original sigue siendo evidencia privada y no se sirve a visitantes.",
        backAction: { label: "Volver a todas las demostraciones", href: "/es/demos" },
        supportAction: { label: "Comprobar informes de problemas", href: "/es/contact?topic=support" },
      },
      "conversion-1-4": {
        metadata: {
          title: "Demostración Conversión 1.4",
          description:
            "Copia privada de revisión del prototipo de reconstrucción JavaScript Conversión 1.4 sin validar.",
        },
        eyebrow: "Prototipo de reconstrucción sin validar",
        title: "Conversión 1.4",
        summary:
          "Este segundo prototipo intenta traducir movimiento, etiquetas y tiempos archivados a JavaScript sostenible. Las pruebas requeridas de fidelidad visual y de comportamiento siguen incompletas.",
        statusLabel: "Prototipo de revisión privada",
        statusDetail: "Sin publicación pública · Validación incompleta · Derechos pendientes",
        instructionsTitle: "Antes de comenzar",
        instructions: [
          "Sigue la secuencia desde el estado inicial hasta el estado explicativo final.",
          "Usa Reproducir o Pausar en cualquier momento, o Reiniciar para volver al estado inicial.",
          "Usa el control de fotogramas con el puntero o las flechas del teclado para revisar cualquier estado sin movimiento automático.",
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
        frameLabel: "Fotograma de la animación",
        reducedMotionNote:
          "Si está activado el movimiento reducido, la experiencia puede limitar el movimiento automático y mantener disponibles los estados didácticos.",
        accessibilityTitle: "Notas de acceso",
        accessibilityNotes: [
          "La actividad usa las dimensiones de escenario registradas por la auditoría automática parcial.",
          "Los controles visibles admiten foco y activación mediante teclado.",
          "El texto y los controles los presenta la página moderna, no un complemento obsoleto.",
        ],
        disclaimerTitle: "Límites del prototipo",
        disclaimer:
          "Esta implementación privada no es una migración terminada ni fiel, una lección, curso, evaluación o afirmación actual de eficacia. No guarda respuestas, puntuaciones ni progreso. El material Flash original sigue siendo evidencia privada y no se sirve a visitantes.",
        backAction: { label: "Volver a todas las demostraciones", href: "/es/demos" },
        supportAction: { label: "Comprobar informes de problemas", href: "/es/contact?topic=support" },
      },
    },
    privacy: {
      metadata: {
        title: "Aviso de privacidad",
        description:
          "Conoce qué procesa el sitio HELP Math, qué podría procesarse si se abre el contacto verificado y por qué no deben enviarse expedientes estudiantiles.",
      },
      hero: {
        eyebrow: "Aviso de privacidad",
        title: "Una versión pública diseñada para recopilar menos",
        summary:
          "El sitio ofrece información y estado de publicación de demostraciones sin cuentas ni almacenamiento de datos de aprendizaje. Este aviso explica las operaciones actuales y los datos limitados que se usarían si se abre el contacto verificado para adultos.",
      },
      effectiveDateLabel: "Última actualización",
      effectiveDate: "21 de julio de 2026",
      reviewNotice:
        "Borrador para revisión del titular. No es un aviso legal definitivo. Refleja la configuración prevista y debe actualizarse si cambian proveedores, flujos de datos o servicios.",
      sections: [
        {
          id: "scope",
          title: "1. Alcance",
          paragraphs: [
            "Este aviso se aplica al sitio público HELP Math en helpmath.ai, incluidas sus páginas informativas, estado de publicación de demostraciones, estado de contacto y formulario verificado si se habilita.",
            "No describe una plataforma estudiantil, porque este lanzamiento no incluye cuentas, clases, tareas, compras ni almacenamiento de progreso.",
          ],
        },
        {
          id: "information",
          title: "2. Información que procesamos",
          paragraphs: [
            "Puedes navegar por el contenido informativo público sin dar tu nombre ni crear una cuenta.",
          ],
          bullets: [
            "Si se habilita el contacto verificado, la información y el mensaje que decidas enviar: función, nombre, correo, organización, tema y contenido.",
            "Información técnica limitada que procesan nuestros servicios de alojamiento, seguridad y rendimiento, como hora, página, navegador o dispositivo, ubicación aproximada de red y dirección IP.",
            "Si se habilita el formulario, señales contra el abuso necesarias para protegerlo de envíos automatizados.",
          ],
        },
        {
          id: "use",
          title: "3. Cómo utilizamos la información",
          paragraphs: [
            "Usamos información técnica para operar y proteger el sitio, resolver errores y comprender el rendimiento agregado. Si el contacto se abre, la información enviada también se usaría para responder y mantener un registro apropiado.",
            "Ningún formulario público se usa para crear perfiles de aprendizaje, calificar trabajo estudiantil ni tomar decisiones educativas automatizadas.",
          ],
        },
        {
          id: "student-data",
          title: "4. Información estudiantil y sensible",
          paragraphs: [
            "No envíes nombres, calificaciones, respuestas de evaluaciones, discapacidad, fechas de nacimiento, identificadores, listas de clase, usuarios, contraseñas ni otros expedientes educativos. El formulario no es un canal seguro aprobado para ello.",
            "Los estudiantes deben pedir a un adulto de confianza que compruebe la disponibilidad de contacto. Si alguna vez se requiere información protegida, una organización autorizada debe acordar previamente un proceso independiente y revisado.",
          ],
        },
        {
          id: "sharing",
          title: "5. Proveedores y divulgación",
          paragraphs: [
            "Prevemos usar Vercel para alojar y supervisar el sitio. Si se abre el contacto verificado, Cloudflare Turnstile y Resend protegerían y entregarían mensajes. Estos proveedores pueden procesar información limitada bajo sus propios términos.",
            "No vendemos información personal. Podemos divulgarla cuando sea necesario para prestar asistencia, proteger el sitio o a las personas, cumplir la ley o completar una transición organizativa con salvaguardas adecuadas.",
          ],
        },
        {
          id: "retention",
          title: "6. Conservación y seguridad",
          paragraphs: [
            "Si se aceptan mensajes, se conservarían solo durante el tiempo razonablemente necesario para responder, mantener registros, resolver disputas y cumplir obligaciones. Los registros de alojamiento y seguridad siguen los periodos configurados.",
            "Aplicamos salvaguardas administrativas y técnicas razonables, pero ningún correo, formulario o transmisión por internet puede garantizarse como totalmente seguro. Por eso tampoco deben enviarse expedientes sensibles.",
          ],
        },
        {
          id: "choices",
          title: "7. Tus opciones",
          paragraphs: [
            "Puedes navegar sin usar el contacto. Si enviaste información mediante un formulario habilitado, comprueba la página de estado para solicitar acceso, corrección o eliminación. Puede ser necesaria una verificación.",
          ],
        },
        {
          id: "international",
          title: "8. Visitantes internacionales",
          paragraphs: [
            "Nuestros proveedores pueden procesar información en Estados Unidos y otros lugares. Los derechos y requisitos de transferencia varían; comprueba la disponibilidad de contacto para una pregunta regional.",
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
          "Comprueba si el contacto verificado está abierto. Si lo está, elige Consulta sobre privacidad y no incluyas expedientes sensibles.",
        action: { label: "Comprobar disponibilidad de contacto", href: "/es/contact?topic=privacy" },
      },
    },
    terms: {
      metadata: {
        title: "Términos de uso",
        description:
          "Consulta los términos preliminares del sitio HELP Math, su contenido, contexto histórico y cualquier demostración futura.",
      },
      hero: {
        eyebrow: "Términos de uso",
        title: "Utiliza responsablemente la versión preliminar pública",
        summary:
          "Estos términos cubren el sitio informativo y también se aplicarían a cualquier demostración pública futura salvo aviso distinto. No crean una cuenta, suscripción, compra, licencia ni garantía de acceso.",
      },
      effectiveDateLabel: "Última actualización",
      effectiveDate: "21 de julio de 2026",
      reviewNotice:
        "Borrador para revisión del titular y asesoría legal. No son términos definitivos. La entidad responsable, jurisdicción, dirección de contacto y posibles licencias de demostraciones deben confirmarse para producción.",
      sections: [
        {
          id: "acceptance",
          title: "1. Aceptación y requisitos",
          paragraphs: [
            "Al usar el sitio, aceptas estos términos y el aviso de privacidad. Si no estás de acuerdo, no utilices el sitio.",
            "Todo formulario habilitado está dirigido a adultos. Los estudiantes deben usar el contenido con orientación apropiada y pedir a un adulto que compruebe la disponibilidad de contacto.",
          ],
        },
        {
          id: "service",
          title: "2. Qué ofrece este sitio",
          paragraphs: [
            "El sitio ofrece actualmente información, contexto histórico, estado de asistencia y estado de publicación de demostraciones durante una modernización activa.",
            "Actualmente no ofrece matrículas, cuentas, clases, tareas, evaluación, informes de progreso, pagos ni acceso garantizado al programa histórico.",
          ],
        },
        {
          id: "acceptable-use",
          title: "3. Uso aceptable",
          paragraphs: [
            "Puedes acceder a las páginas públicas para evaluación personal, revisión docente y referencia educativa ordinaria, sujeto a estos términos y a los avisos de cada recurso.",
          ],
          bullets: [
            "No interfieras con el sitio, eludas medidas de seguridad o acceso ni sobrecargues los servicios.",
            "No uses sistemas automatizados para extraer, copiar o redistribuir a gran escala el archivo o futuras demostraciones sin permiso escrito.",
            "No cargues código malicioso, suplantes a otra persona ni uses el formulario para correo basura o actividades ilícitas.",
            "No envíes expedientes estudiantiles, contraseñas ni otra información sensible.",
          ],
        },
        {
          id: "intellectual-property",
          title: "4. Propiedad intelectual y material histórico",
          paragraphs: [
            "El sitio, nombre del proyecto, futuras demostraciones, textos, imágenes, fuentes y otros contenidos pueden estar protegidos por derechos de autor, marcas, contratos u otros derechos. El acceso público no transfiere titularidad ni concede derecho a republicar, vender, modificar, extraer o crear un archivo competidor.",
            "Los nombres y materiales históricos pueden reflejar derechos de sus titulares. Comprueba el estado de contacto sobre permisos antes de un uso que exceda la visualización ordinaria o la evaluación docente.",
          ],
        },
        {
          id: "educational-use",
          title: "5. Contexto educativo",
          paragraphs: [
            "Cualquier demostración futura sería un ejemplo didáctico limitado, no un currículo completo, instrumento diagnóstico, intervención individualizada ni sustituto del criterio docente.",
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
          "Comprueba el estado de contacto sobre permisos antes de copiar, publicar, licenciar o distribuir materiales más allá del uso normal del sitio público.",
        action: { label: "Comprobar contacto sobre permisos", href: "/es/contact?topic=permissions" },
      },
    },
  },
} satisfies SiteContent;
