// Paint controls, selection guidance and project messages. English keys stay in the owning UI.
const rows = [
  [
    "Citadel Paint",
    "Citadel Paint",
    "Citadel Paint",
    "Citadel Paint"
  ],
  [
    "Direct model painting · Rest pose",
    "Рисование на модели · Исходная поза",
    "Pintura sobre el modelo · Pose de reposo",
    "模型绘画 · 静止姿势"
  ],
  [
    "A source texture is not loaded; this part will use primer until it is available.",
    "Текстура не загружена; пока эта часть использует грунт.",
    "La textura no está cargada; esta parte usará una base provisional.",
    "源纹理未加载；此部位暂时使用底色。"
  ],
  [
    "Paint target",
    "Область рисования",
    "Destino de pintura",
    "绘画目标"
  ],
  [
    "Click the model to choose a part.",
    "Нажмите на модель, чтобы выбрать часть.",
    "Haz clic en el modelo para elegir una parte.",
    "点击模型以选择部位。"
  ],
  [
    "Parts using the same texture pixels paint together, even while hidden.",
    "Части с общими пикселями текстуры окрашиваются вместе, даже если скрыты.",
    "Las partes que comparten píxeles se pintan juntas, aunque estén ocultas.",
    "共用纹理像素的部位会一起被绘制，即使它们已隐藏。"
  ],
  [
    "Coats",
    "Слои краски",
    "Capas de pintura",
    "颜料图层"
  ],
  [
    "Base",
    "Основа",
    "Base",
    "底层"
  ],
  [
    "Shade",
    "Тени",
    "Sombras",
    "阴影"
  ],
  [
    "Detail",
    "Детали",
    "Detalle",
    "细节"
  ],
  [
    "Weathering",
    "Износ",
    "Desgaste",
    "磨损"
  ],
  [
    "Brushes",
    "Кисти",
    "Pinceles",
    "画笔"
  ],
  [
    "Normal",
    "Обычная",
    "Normal",
    "普通"
  ],
  [
    "Round",
    "Круглая",
    "Redondo",
    "圆形"
  ],
  [
    "Soft",
    "Мягкая",
    "Suave",
    "柔边"
  ],
  [
    "Basecoat",
    "Базовый слой",
    "Capa base",
    "底色"
  ],
  [
    "Wash",
    "Проливка",
    "Lavado",
    "渍洗"
  ],
  [
    "Drybrush",
    "Сухая кисть",
    "Pincel seco",
    "干扫"
  ],
  [
    "Texture",
    "Текстура",
    "Textura",
    "纹理"
  ],
  [
    "Stamp",
    "Штамп",
    "Sello",
    "印章"
  ],
  [
    "Eraser",
    "Ластик",
    "Borrador",
    "橡皮擦"
  ],
  [
    "Brush tips",
    "Формы кисти",
    "Puntas de pincel",
    "笔尖"
  ],
  [
    "Basic shape",
    "Простая форма",
    "Forma básica",
    "基本形状"
  ],
  [
    "Brushy Bristle",
    "Грубая щетина",
    "Cerda gruesa",
    "粗鬃毛"
  ],
  [
    "Chisel Bristle",
    "Плоская щетина",
    "Cerda plana",
    "扁鬃毛"
  ],
  [
    "Scumble",
    "Потёртости",
    "Restregado",
    "擦痕"
  ],
  [
    "Fine Grain",
    "Мелкое зерно",
    "Grano fino",
    "细颗粒"
  ],
  [
    "Surface Scratches",
    "Царапины",
    "Arañazos",
    "表面划痕"
  ],
  [
    "Armor Cracks",
    "Трещины брони",
    "Grietas de armadura",
    "盔甲裂纹"
  ],
  [
    "Chipped Paint",
    "Сколы краски",
    "Pintura desconchada",
    "掉漆"
  ],
  [
    "Scuffed Paint",
    "Потёртая краска",
    "Pintura rozada",
    "磨损油漆"
  ],
  [
    "Texture palette",
    "Палитра текстур",
    "Paleta de texturas",
    "纹理调色板"
  ],
  [
    "Skin",
    "Кожа",
    "Piel",
    "皮肤"
  ],
  [
    "Hair & Fur",
    "Волосы и мех",
    "Pelo y pelaje",
    "毛发"
  ],
  [
    "Metal",
    "Металл",
    "Metal",
    "金属"
  ],
  [
    "Leather & Cloth",
    "Кожа и ткань",
    "Cuero y tela",
    "皮革与布料"
  ],
  [
    "Bone & Wood",
    "Кость и дерево",
    "Hueso y madera",
    "骨骼与木材"
  ],
  [
    "Brush Size",
    "Размер кисти",
    "Tamaño del pincel",
    "画笔大小"
  ],
  [
    "Brush Zoom",
    "Масштаб кисти",
    "Escala del pincel",
    "画笔缩放"
  ],
  [
    "Hardness",
    "Жёсткость",
    "Dureza",
    "硬度"
  ],
  [
    "Bleed",
    "Сглаживание",
    "Suavizado",
    "平滑"
  ],
  [
    "Preview smoothing: off shows sharp texture pixels; on blends their edges. Does not change painted pixels or Warcraft texture filtering.",
    "Сглаживание предпросмотра: выключите для чётких пикселей, включите для мягких краёв. Пиксели и фильтрация Warcraft не меняются.",
    "Suavizado de vista: desactivado muestra píxeles nítidos; activado suaviza sus bordes. No modifica los píxeles ni el filtrado de Warcraft.",
    "预览平滑：关闭时显示清晰像素，开启时柔化边缘。不会改变纹理像素或魔兽纹理过滤。"
  ],
  [
    "Flow",
    "Подача краски",
    "Flujo",
    "流量"
  ],
  [
    "Spacing",
    "Интервал",
    "Espaciado",
    "间距"
  ],
  [
    "Strength",
    "Сила",
    "Intensidad",
    "强度"
  ],
  [
    "RGB filter",
    "Фильтр RGB",
    "Filtro RGB",
    "RGB 滤镜"
  ],
  [
    "Reset RGB filter",
    "Сбросить фильтр RGB",
    "Restablecer filtro RGB",
    "重置 RGB 滤镜"
  ],
  [
    "Color",
    "Цвет",
    "Color",
    "颜色"
  ],
  [
    "Technique",
    "Техника",
    "Técnica",
    "技法"
  ],
  [
    "Paint mode",
    "Режим рисования",
    "Modo de pintura",
    "绘画模式"
  ],
  [
    "Free Paint",
    "Свободное рисование",
    "Pintura libre",
    "自由绘画"
  ],
  [
    "Geoset Paint",
    "Рисование по геосету",
    "Pintar geoset",
    "几何组绘画"
  ],
  [
    "Paint any visible surface under the brush. The brush can cross geosets and materials.",
    "Рисуйте по любой видимой поверхности. Кисть может пересекать геосеты и материалы.",
    "Pinta cualquier superficie visible. El pincel puede cruzar geosets y materiales.",
    "绘制任何可见表面。画笔可跨越几何组和材质。"
  ],
  [
    "Paint only the selected geoset.",
    "Рисовать только по выбранному геосету.",
    "Pinta solo el geoset seleccionado.",
    "仅绘制选中的几何组。"
  ],
  [
    "Apply to material",
    "Нанести на материал",
    "Aplicar al material",
    "应用到材质"
  ],
  [
    "Coat the whole target; Wash and Drybrush automatically follow its sculpted forms.",
    "Покрыть всю область; проливка и сухая кисть следуют форме поверхности.",
    "Cubre todo el destino; el lavado y el pincel seco siguen el relieve.",
    "覆盖整个目标；渍洗和干扫会跟随表面形状。"
  ],
  [
    "Visible",
    "Видимость",
    "Visible",
    "可见"
  ],
  [
    "Texture source selected.",
    "Источник текстуры выбран.",
    "Fuente de textura seleccionada.",
    "已选择纹理来源。"
  ],
  [
    "Preparing paint and texture targets…",
    "Подготовка рисования и текстур…",
    "Preparando pintura y texturas…",
    "正在准备绘画和纹理…"
  ],
  [
    "Click a model part with a paintable texture.",
    "Нажмите на часть модели с доступной текстурой.",
    "Haz clic en una parte del modelo con textura editable.",
    "点击模型上具有可绘制纹理的部位。"
  ],
  [
    "Paint target prepared. Paint it with the next stroke.",
    "Область готова. Рисуйте следующим мазком.",
    "Destino preparado. Pinta con el siguiente trazo.",
    "目标已准备好。可以开始绘制。"
  ],
  [
    "Editable paint preset saved.",
    "Проект рисования сохранён.",
    "Proyecto de pintura guardado.",
    "已保存可编辑绘画项目。"
  ],
  [
    "Editable paint project reopened.",
    "Проект рисования открыт.",
    "Proyecto de pintura abierto.",
    "已重新打开可编辑绘画项目。"
  ],
  [
    "Ready-to-import Warcraft package saved.",
    "Пакет для импорта в Warcraft сохранён.",
    "Paquete de Warcraft listo para importar guardado.",
    "已保存可导入魔兽的资源包。"
  ],
  [
    "There is no earlier paint stroke.",
    "Нет более раннего мазка.",
    "No hay trazos anteriores.",
    "没有更早的笔画。"
  ],
  [
    "There is no later paint stroke.",
    "Нет более позднего мазка.",
    "No hay trazos posteriores.",
    "没有可重做的笔画。"
  ],
  [
    "Export Warcraft",
    "Экспорт в Warcraft",
    "Exportar a Warcraft",
    "导出到魔兽"
  ],
  [
    "Return to model",
    "Вернуться к модели",
    "Volver al modelo",
    "返回模型"
  ],
  [
    "Free Paint is ready. Paint any visible surface, or switch to Geoset Paint.",
    "Свободное рисование готово. Рисуйте по видимой поверхности или выберите геосет.",
    "Pintura libre lista. Pinta una superficie visible o elige Pintar geoset.",
    "自由绘画已就绪。绘制可见表面，或切换到几何组绘画。"
  ],
  [
    "Right-drag: pan · Middle-click: rotation / work · Wheel: zoom",
    "Правая кнопка: сдвиг · Средняя: вращение / работа · Колесо: масштаб",
    "Arrastrar con botón derecho: desplazar · Clic central: girar / editar · Rueda: zoom",
    "右键拖动：平移 · 中键：旋转 / 编辑 · 滚轮：缩放"
  ],
  [
    "Paint",
    "Краска",
    "Pintar",
    "绘画"
  ],
  [
    "Pick geoset",
    "Выбрать геосет",
    "Elegir geoset",
    "选择几何组"
  ],
  [
    "Select a geoset or lamp. Drag a lamp to move it; use Near / far for depth.",
    "Выберите геосет или лампу. Перетаскивайте лампу; расстояние регулируется отдельно.",
    "Elige un geoset o una luz. Arrastra la luz; ajusta su profundidad con Cerca / lejos.",
    "选择几何组或灯光。拖动灯光移动；用远近调节深度。"
  ],
  [
    "Geoset Selection",
    "Выбор геосета",
    "Selección de geoset",
    "几何组选择"
  ],
  [
    "Show only this geoset",
    "Показать только этот геосет",
    "Mostrar solo este geoset",
    "仅显示此几何组"
  ],
  [
    "Highlight border",
    "Подсветить границу",
    "Resaltar borde",
    "高亮边界"
  ],
  [
    "Thickness",
    "Толщина",
    "Grosor",
    "粗细"
  ],
  [
    "Fit model",
    "Вписать модель",
    "Encuadrar modelo",
    "适配模型"
  ],
  [
    "Hide half",
    "Скрыть половину",
    "Ocultar mitad",
    "隐藏一半"
  ],
  [
    "View both sides",
    "Показать обе стороны",
    "Mostrar ambos lados",
    "显示两侧"
  ],
  [
    "Mirror half hidden",
    "Зеркальная половина скрыта",
    "Mitad reflejada oculta",
    "镜像半边已隐藏"
  ],
  [
    "Mirror axis",
    "Ось зеркала",
    "Eje de simetría",
    "镜像轴"
  ],
  [
    "Visible half",
    "Видимая половина",
    "Mitad visible",
    "可见半边"
  ],
  [
    "Positive side (+)",
    "Положительная сторона (+)",
    "Lado positivo (+)",
    "正侧 (+)"
  ],
  [
    "Negative side (−)",
    "Отрицательная сторона (−)",
    "Lado negativo (−)",
    "负侧 (−)"
  ],
  [
    "Low-power view",
    "Экономный просмотр",
    "Vista de bajo consumo",
    "低功耗视图"
  ],
  [
    "Show hidden model parts",
    "Показать скрытые части",
    "Mostrar partes ocultas",
    "显示隐藏部位"
  ],
  [
    "View options",
    "Настройки вида",
    "Opciones de vista",
    "视图选项"
  ],
  [
    "More brushes & settings",
    "Другие кисти и настройки",
    "Más pinceles y ajustes",
    "更多画笔和设置"
  ],
  [
    "Size controls coverage; Zoom controls texture detail. Drybrush catches raised surfaces; Wash settles into crevices.",
    "Размер задаёт охват, масштаб — детали текстуры. Сухая кисть выделяет выступы, проливка — углубления.",
    "El tamaño controla la cobertura; la escala, el detalle. El pincel seco resalta relieves; el lavado rellena huecos.",
    "大小控制覆盖范围，缩放控制纹理细节。干扫突出凸起，渍洗填充凹陷。"
  ],
  [
    "Texture category",
    "Категория текстур",
    "Categoría de textura",
    "纹理类别"
  ],
  [
    "Choose a texture, then brush it onto the selected geoset.",
    "Выберите текстуру и нанесите её на геосет кистью.",
    "Elige una textura y aplícala al geoset con el pincel.",
    "选择纹理，然后用画笔涂到选中的几何组上。"
  ],
  [
    "Fill selected geoset",
    "Залить выбранный геосет",
    "Rellenar geoset seleccionado",
    "填充选中的几何组"
  ],
  [
    "Covers this geoset in one step. Undo restores it.",
    "Покрывает геосет за один шаг. Можно отменить.",
    "Cubre el geoset en un paso. Se puede deshacer.",
    "一步覆盖几何组。可撤销。"
  ],
  [
    "Separate layers of paint. Start with Base; add others when needed.",
    "Отдельные слои краски. Начните с основы, добавляйте остальные по мере надобности.",
    "Capas de pintura separadas. Empieza con Base y añade otras cuando las necesites.",
    "独立的颜料图层。从底层开始，按需添加其他层。"
  ],
  [
    "Show the active coat before painting it.",
    "Включите видимость активного слоя перед рисованием.",
    "Muestra la capa activa antes de pintar.",
    "绘画前请显示当前图层。"
  ],
  [
    "Geoset Paint only paints the selected geoset.",
    "Этот режим рисует только по выбранному геосету.",
    "Este modo solo pinta el geoset seleccionado.",
    "此模式仅绘制选中的几何组。"
  ],
  [
    "Loading texture…",
    "Загрузка текстуры…",
    "Cargando textura…",
    "正在加载纹理…"
  ],
  [
    "Unsaved paint",
    "Несохранённая краска",
    "Pintura sin guardar",
    "绘画未保存"
  ],
  [
    "No unsaved paint",
    "Нет несохранённых изменений",
    "Sin pintura pendiente",
    "绘画已保存"
  ],
  [
    "Cut position",
    "Положение среза",
    "Posición del corte",
    "裁切位置"
  ],
  [
    "Centre on geoset",
    "Центрировать по геосету",
    "Centrar en geoset",
    "以几何组为中心"
  ],
  [
    "Texture cutout",
    "Фрагмент текстуры",
    "Recorte de textura",
    "纹理裁剪"
  ],
  [
    "Crop / select…",
    "Вырезать / выделить…",
    "Recortar / seleccionar…",
    "裁剪 / 选择…"
  ],
  [
    "Rectangle",
    "Прямоугольник",
    "Rectángulo",
    "矩形"
  ],
  [
    "Square / circle (1:1)",
    "Квадрат / круг (1:1)",
    "Cuadrado / círculo (1:1)",
    "正方形 / 圆形 (1:1)"
  ],
  [
    "Ellipse / circle",
    "Эллипс / круг",
    "Elipse / círculo",
    "椭圆 / 圆形"
  ],
  [
    "Freehand lasso",
    "Свободное лассо",
    "Lazo libre",
    "自由套索"
  ],
  [
    "Polygon lasso",
    "Многоугольное лассо",
    "Lazo poligonal",
    "多边形套索"
  ],
  [
    "Magic wand",
    "Волшебная палочка",
    "Varita mágica",
    "魔棒"
  ],
  [
    "Replace selection",
    "Новое выделение",
    "Reemplazar selección",
    "替换选区"
  ],
  [
    "Add to selection",
    "Добавить к выделению",
    "Añadir a selección",
    "添加到选区"
  ],
  [
    "Subtract selection",
    "Вычесть из выделения",
    "Restar selección",
    "从选区减去"
  ],
  [
    "Intersect selection",
    "Пересечь выделения",
    "Intersecar selección",
    "选区交集"
  ],
  [
    "Select none",
    "Снять выделение",
    "No seleccionar nada",
    "取消选择"
  ],
  [
    "Selection mode",
    "Режим выделения",
    "Modo de selección",
    "选择模式"
  ],
  [
    "Tolerance",
    "Допуск",
    "Tolerancia",
    "容差"
  ],
  [
    "Connected pixels only",
    "Только соседние пиксели",
    "Solo píxeles contiguos",
    "仅相邻像素"
  ],
  [
    "Feather edge (px)",
    "Растушёвка (пкс)",
    "Difuminar borde (px)",
    "羽化边缘 (px)"
  ],
  [
    "Zoom",
    "Масштаб",
    "Zoom",
    "缩放"
  ],
  [
    "Finish polygon",
    "Замкнуть контур",
    "Cerrar polígono",
    "完成多边形"
  ],
  [
    "Click points; double-click or Enter to finish.",
    "Ставьте точки; двойной щелчок или Enter завершает контур.",
    "Marca puntos; doble clic o Enter para terminar.",
    "点击添加顶点；双击或按 Enter 完成。"
  ],
  [
    "Drag a selection. Shift adds; Ctrl subtracts.",
    "Выделяйте перетаскиванием. Shift добавляет, Ctrl вычитает.",
    "Arrastra para seleccionar. Shift añade; Ctrl resta.",
    "拖动选择。Shift 添加，Ctrl 减去。"
  ],
  [
    "Use cutout as source",
    "Использовать фрагмент",
    "Usar recorte",
    "使用裁剪部分"
  ],
  [
    "Use full texture as source",
    "Использовать всю текстуру",
    "Usar textura completa",
    "使用完整纹理"
  ],
  [
    "Save as texture…",
    "Сохранить как текстуру…",
    "Guardar como textura…",
    "另存为纹理…"
  ],
  [
    "Cut out the part you want, then place it as a stamp. Keep it in your library to use it again.",
    "Вырежьте нужный фрагмент и поставьте его штампом. Сохраните в библиотеку для повторного использования.",
    "Recorta una parte y úsala como sello. Guárdala en tu biblioteca para reutilizarla.",
    "裁出所需部分并作为印章放置。保存到素材库以便再次使用。"
  ],
  [
    "Texture folder",
    "Папка текстур",
    "Carpeta de texturas",
    "纹理文件夹"
  ],
  [
    "All texture folders",
    "Все папки текстур",
    "Todas las carpetas",
    "所有纹理文件夹"
  ],
  [
    "Search your textures",
    "Поиск своих текстур",
    "Buscar tus texturas",
    "搜索个人纹理"
  ],
  [
    "WC3 library…",
    "Библиотека WC3…",
    "Biblioteca WC3…",
    "WC3 素材库…"
  ],
  [
    "Add from file…",
    "Добавить из файла…",
    "Añadir desde archivo…",
    "从文件添加…"
  ],
  [
    "Refresh",
    "Обновить",
    "Actualizar",
    "刷新"
  ],
  [
    "Open folder",
    "Открыть папку",
    "Abrir carpeta",
    "打开文件夹"
  ],
  [
    "Texture Name",
    "Имя текстуры",
    "Nombre de textura",
    "纹理名称"
  ],
  [
    "Format",
    "Формат",
    "Formato",
    "格式"
  ],
  [
    "Folder inside Textures",
    "Папка внутри Textures",
    "Carpeta dentro de Textures",
    "Textures 内的文件夹"
  ],
  [
    "My textures/Armour",
    "Мои текстуры/Броня",
    "Mis texturas/Armadura",
    "我的纹理/盔甲"
  ],
  [
    "Choose a folder or type a new subfolder. Folder names are yours to change.",
    "Выберите папку или введите новую. Имена папок можно менять.",
    "Elige una carpeta o escribe una nueva. Puedes cambiar sus nombres.",
    "选择文件夹或输入新子文件夹。文件夹名称可自行更改。"
  ],
  [
    "Saves a separate texture file.",
    "Сохраняет отдельный файл текстуры.",
    "Guarda un archivo de textura independiente.",
    "保存为独立纹理文件。"
  ],
  [
    "Save to Textures",
    "Сохранить в Textures",
    "Guardar en Textures",
    "保存到 Textures"
  ],
  [
    "Save elsewhere…",
    "Сохранить в другом месте…",
    "Guardar en otro lugar…",
    "保存到其他位置…"
  ],
  [
    "Enter a filename without folder separators.",
    "Введите имя файла без разделителей папок.",
    "Escribe un nombre sin separadores de carpeta.",
    "请输入不含路径分隔符的文件名。"
  ],
  [
    "Texture copy saved. Your folder list has been refreshed.",
    "Копия текстуры сохранена. Список папок обновлён.",
    "Copia guardada. Lista de carpetas actualizada.",
    "已保存纹理副本。文件夹列表已刷新。"
  ],
  [
    "Scene & light",
    "Сцена и свет",
    "Escena y luz",
    "场景与灯光"
  ],
  [
    "Solid colour",
    "Сплошной цвет",
    "Color sólido",
    "纯色"
  ],
  [
    "Background colour",
    "Цвет фона",
    "Color de fondo",
    "背景颜色"
  ],
  [
    "Choose image…",
    "Выбрать изображение…",
    "Elegir imagen…",
    "选择图片…"
  ],
  [
    "Image display",
    "Размещение изображения",
    "Ajuste de imagen",
    "图片显示"
  ],
  [
    "Fill",
    "Заполнить",
    "Rellenar",
    "填充"
  ],
  [
    "Stretch",
    "Растянуть",
    "Estirar",
    "拉伸"
  ],
  [
    "Centre",
    "По центру",
    "Centrar",
    "居中"
  ],
  [
    "Paint colours (unlit)",
    "Цвета краски (без света)",
    "Colores de pintura (sin luz)",
    "颜料颜色（无光照）"
  ],
  [
    "Warcraft day / night",
    "День / ночь Warcraft",
    "Día / noche Warcraft",
    "魔兽昼夜光照"
  ],
  [
    "Lamps only",
    "Только лампы",
    "Solo luces",
    "仅灯光"
  ],
  [
    "Warcraft environment",
    "Окружение Warcraft",
    "Entorno Warcraft",
    "魔兽环境"
  ],
  [
    "Time of day",
    "Время суток",
    "Hora del día",
    "一天中的时间"
  ],
  [
    "Dawn",
    "Рассвет",
    "Amanecer",
    "黎明"
  ],
  [
    "Noon",
    "Полдень",
    "Mediodía",
    "正午"
  ],
  [
    "Dusk",
    "Закат",
    "Atardecer",
    "黄昏"
  ],
  [
    "Midnight",
    "Полночь",
    "Medianoche",
    "午夜"
  ],
  [
    "Custom DNC model",
    "Своя модель DNC",
    "Modelo DNC propio",
    "自定义 DNC 模型"
  ],
  [
    "Open DNC model…",
    "Открыть модель DNC…",
    "Abrir modelo DNC…",
    "打开 DNC 模型…"
  ],
  [
    "Lamps",
    "Лампы",
    "Luces",
    "灯光"
  ],
  [
    "Add lamp",
    "Добавить лампу",
    "Añadir luz",
    "添加灯光"
  ],
  [
    "Lamp on",
    "Лампа включена",
    "Luz encendida",
    "灯光开启"
  ],
  [
    "Warcraft light type",
    "Тип света Warcraft",
    "Tipo de luz Warcraft",
    "魔兽灯光类型"
  ],
  [
    "Directional (point it)",
    "Направленный свет",
    "Luz direccional",
    "平行光"
  ],
  [
    "Warcraft torch / omni light",
    "Факел / всенаправленный свет",
    "Antorcha / luz omnidireccional",
    "火炬 / 点光源"
  ],
  [
    "Light colour",
    "Цвет света",
    "Color de luz",
    "灯光颜色"
  ],
  [
    "Intensity",
    "Яркость",
    "Intensidad",
    "亮度"
  ],
  [
    "Point toward",
    "Направить на",
    "Apuntar hacia",
    "朝向"
  ],
  [
    "Place beside model…",
    "Поставить рядом с моделью…",
    "Colocar junto al modelo…",
    "放在模型旁边…"
  ],
  [
    "Move in view",
    "Переместить в кадре",
    "Mover en la vista",
    "在视图中移动"
  ],
  [
    "Distance from model",
    "Расстояние от модели",
    "Distancia al modelo",
    "距模型的距离"
  ],
  [
    "Nearer is brighter. Farther is dimmer.",
    "Ближе — ярче. Дальше — темнее.",
    "Más cerca: más brillo. Más lejos: menos brillo.",
    "越近越亮，越远越暗。"
  ],
  [
    "Point at model…",
    "Направить на модель…",
    "Apuntar al modelo…",
    "指向模型…"
  ],
  [
    "Bring lamp into view",
    "Вернуть лампу в кадр",
    "Traer luz a la vista",
    "将灯光移入视图"
  ],
  [
    "Remove lamp",
    "Удалить лампу",
    "Eliminar luz",
    "删除灯光"
  ],
  [
    "Show lamp markers",
    "Показать значки ламп",
    "Mostrar marcadores de luz",
    "显示灯光标记"
  ],
  [
    "Drag to move the lamp. Near / far moves it in depth; Around model moves the light to another side. Right-drag still turns your view.",
    "Перетаскивайте лампу. Ближе / дальше меняет глубину; вращение вокруг модели освещает другую сторону. Правая кнопка по-прежнему управляет видом.",
    "Arrastra la luz. Cerca / lejos cambia su profundidad; alrededor del modelo ilumina otro lado. El botón derecho sigue controlando la vista.",
    "拖动灯光移动。远近调节深度；绕模型移动可照亮另一侧。右键仍控制视图。"
  ],
  [
    "Preview only. Lighting never changes your texture pixels or adds light nodes to the exported model.",
    "Только предпросмотр. Свет не меняет пиксели текстуры и не добавляет узлы света при экспорте.",
    "Solo vista previa. La luz no altera píxeles ni añade nodos de luz al modelo exportado.",
    "仅用于预览。光照不会改变纹理像素，也不会向导出的模型添加灯光节点。"
  ],
  [
    "Using the DNC model’s animated unit-light values.",
    "Используются анимированные параметры света из модели DNC.",
    "Se usan los valores de luz animados del modelo DNC.",
    "正在使用 DNC 模型中的动画单位光照值。"
  ],
  [
    "Reading Warcraft day / night lights…",
    "Чтение света дня / ночи Warcraft…",
    "Leyendo luces de día / noche Warcraft…",
    "正在读取魔兽昼夜光照…"
  ],
  [
    "Choose a DNC model, or use the desktop app’s installed Warcraft data.",
    "Выберите модель DNC или данные Warcraft в настольной версии.",
    "Elige un modelo DNC o usa los datos de Warcraft de la aplicación de escritorio.",
    "选择 DNC 模型，或使用桌面应用中的魔兽数据。"
  ],
  [
    "DNC model not found. Choose Warcraft data in Settings or open a DNC model.",
    "Модель DNC не найдена. Укажите данные Warcraft в настройках или откройте DNC.",
    "No se encontró el modelo DNC. Configura los datos de Warcraft o abre un modelo DNC.",
    "找不到 DNC 模型。请在设置中选择魔兽数据，或打开 DNC 模型。"
  ],
  [
    "Click the model to put the lamp beside that point.",
    "Нажмите на модель, чтобы поставить лампу рядом.",
    "Haz clic en el modelo para colocar la luz al lado.",
    "点击模型，将灯光放在该点旁边。"
  ],
  [
    "Move UV mesh",
    "Переместить UV-сетку",
    "Mover malla UV",
    "移动 UV 网格"
  ],
  [
    "Show UV mesh",
    "Показать UV-сетку",
    "Mostrar malla UV",
    "显示 UV 网格"
  ],
  [
    "Scale",
    "Масштаб",
    "Escala",
    "缩放"
  ],
  [
    "Angle",
    "Угол",
    "Ángulo",
    "角度"
  ],
  [
    "Apply to mesh",
    "Применить к сетке",
    "Aplicar a la malla",
    "应用到网格"
  ],
  [
    "Drag the selected geoset’s UV mesh. Changes stay in this preset. Undo restores them.",
    "Перетаскивайте UV-сетку геосета. Изменения сохраняются в проекте и отменяются.",
    "Arrastra la malla UV del geoset. Los cambios se guardan en el proyecto y se pueden deshacer.",
    "拖动所选几何组的 UV 网格。修改保存在项目中，可撤销。"
  ],
  [
    "Texture / UV",
    "Текстура / UV",
    "Textura / UV",
    "纹理 / UV"
  ],
  [
    "Texture applied to the active coat. Undo restores the previous pixels.",
    "Текстура нанесена на активный слой. Можно отменить.",
    "Textura aplicada a la capa activa. Se puede deshacer.",
    "纹理已应用到当前图层。可撤销。"
  ],
  [
    "Place cutout",
    "Поставить фрагмент",
    "Colocar recorte",
    "放置裁剪部分"
  ],
  [
    "Cutout placed on the active coat. Return to brush to paint over it; Undo removes it.",
    "Фрагмент поставлен на активный слой. Можно дорисовать кистью или отменить.",
    "Recorte colocado en la capa activa. Puedes pintar encima o deshacerlo.",
    "裁剪部分已放到当前图层。可继续绘画或撤销。"
  ],
  [
    "Drag onto model or texture",
    "Перетащить на модель или текстуру",
    "Arrastrar al modelo o textura",
    "拖到模型或纹理上"
  ],
  [
    "Return to brush",
    "Вернуться к кисти",
    "Volver al pincel",
    "返回画笔"
  ],
  [
    "Flip H",
    "Отразить по горизонтали",
    "Voltear H",
    "水平翻转"
  ],
  [
    "Flip V",
    "Отразить по вертикали",
    "Voltear V",
    "垂直翻转"
  ],
  [
    "Resume paint",
    "Продолжить рисование",
    "Continuar pintando",
    "继续绘画"
  ],
  [
    "Original skin",
    "Исходная текстура",
    "Textura original",
    "原始纹理"
  ],
  [
    "Viewing the original skin — paint preset kept",
    "Просмотр исходной текстуры — проект сохранён",
    "Viendo la textura original; proyecto conservado",
    "正在查看原始纹理，绘画项目已保留"
  ],
  [
    "New preset",
    "Новый проект",
    "Nuevo proyecto",
    "新建项目"
  ],
  [
    "Start a separate basecoat. Save this preset first to resume it later.",
    "Начните с новой основы. Сначала сохраните этот проект.",
    "Empieza con otra base. Guarda este proyecto primero.",
    "开始新的底色绘画。请先保存当前项目。"
  ],
  [
    "Save and start new",
    "Сохранить и начать заново",
    "Guardar y empezar de nuevo",
    "保存并重新开始"
  ],
  [
    "Discard and start new",
    "Начать без сохранения",
    "Empezar sin guardar",
    "不保存并重新开始"
  ],
  [
    "The last successfully applied model remains available.",
    "Последняя успешно применённая модель сохранена.",
    "El último modelo aplicado sigue disponible.",
    "上次成功应用的模型仍可使用。"
  ],
  [
    "Drag a box. Release to select.",
    "Потяните рамку. Отпустите для выделения.",
    "Arrastra un rectángulo. Suelta para seleccionar.",
    "拖出矩形，松开选择。"
  ],
  [
    "Drag an oval. Release to select.",
    "Потяните овал. Отпустите для выделения.",
    "Arrastra un óvalo. Suelta para seleccionar.",
    "拖出椭圆，松开选择。"
  ],
  [
    "Draw around the patch. Release to close it.",
    "Обведите фрагмент. Отпустите, чтобы замкнуть контур.",
    "Rodea el recorte. Suelta para cerrar el contorno.",
    "沿目标绘制，松开闭合轮廓。"
  ],
  [
    "Click corners. Click the first point or press Enter to finish. Backspace removes a point.",
    "Ставьте углы. Первая точка или Enter замыкает контур. Backspace удаляет точку.",
    "Marca esquinas. Primer punto o Enter para cerrar. Backspace quita un punto.",
    "点击添加顶点。点击起点或按 Enter 完成。Backspace 删除一个点。"
  ],
  [
    "Click a color. Tolerance controls how much is selected.",
    "Нажмите на цвет. Допуск задаёт широту выделения.",
    "Haz clic en un color. La tolerancia controla cuánto se selecciona.",
    "点击颜色。容差决定选择范围。"
  ],
  [
    "Selection feather",
    "Растушёвка выделения",
    "Difuminado de selección",
    "选区羽化"
  ],
  [
    "Selection tolerance",
    "Допуск выделения",
    "Tolerancia de selección",
    "选区容差"
  ],
  [
    "Paint region",
    "Область рисования",
    "Zona de pintura",
    "绘画区域"
  ],
  [
    "Paint region · Destination",
    "Область рисования · Назначение",
    "Zona de pintura · Destino",
    "绘画区域 · 目标"
  ],
  [
    "Esc cancels the outline",
    "Esc отменяет контур",
    "Esc cancela el contorno",
    "Esc 取消轮廓"
  ],
  [
    "Only the selected destination pixels can receive paint. Subtract around details to protect them.",
    "Краска попадёт только в выделенные пиксели. Вычитайте детали из выделения для защиты.",
    "Solo se pintan los píxeles seleccionados. Resta detalles de la selección para protegerlos.",
    "只有选中的目标像素会被绘制。从选区减去细节即可保护它们。"
  ],
  [
    "Could not save this texture. Your paint is still open.",
    "Не удалось сохранить текстуру. Рисование остаётся открытым.",
    "No se pudo guardar la textura. Tu pintura sigue abierta.",
    "无法保存纹理。绘画仍保持打开。"
  ],
  [
    "Keep in my library",
    "Сохранить в библиотеку",
    "Guardar en mi biblioteca",
    "保存到个人素材库"
  ],
  [
    "Paint / Stamp / Erase",
    "Краска / Штамп / Ластик",
    "Pintar / Sello / Borrar",
    "绘画 / 印章 / 擦除"
  ],
  [
    "Toggle selection",
    "Включить выделение",
    "Activar selección",
    "切换选择"
  ],
  [
    "Connected piece / Geoset / Faces",
    "Связная часть / Геосет / Грани",
    "Parte conectada / Geoset / Caras",
    "连接部位 / 几何组 / 面"
  ],
  [
    "Shift + click / drag",
    "Shift + щелчок / перетаскивание",
    "Shift + clic / arrastrar",
    "Shift + 点击 / 拖动"
  ],
  [
    "Add to selection in any tool",
    "Добавить к выделению в любом инструменте",
    "Añadir a selección con cualquier herramienta",
    "使用任何工具时添加到选区"
  ],
  [
    "Ctrl + click / drag",
    "Ctrl + щелчок / перетаскивание",
    "Ctrl + clic / arrastrar",
    "Ctrl + 点击 / 拖动"
  ],
  [
    "Subtract in any tool",
    "Вычесть в любом инструменте",
    "Restar con cualquier herramienta",
    "使用任何工具时从选区减去"
  ],
  [
    "Select all / Clear / Invert",
    "Выбрать всё / Снять / Инвертировать",
    "Seleccionar todo / Limpiar / Invertir",
    "全选 / 清除 / 反选"
  ],
  [
    "Protect texture pixels",
    "Защитить пиксели текстуры",
    "Proteger píxeles de textura",
    "保护纹理像素"
  ],
  [
    "Isolate / Outlines / Colorfy",
    "Изолировать / Контуры / Цвета частей",
    "Aislar / Contornos / Colorear partes",
    "隔离 / 轮廓 / 部位着色"
  ],
  [
    "Shading / Original / Frame model",
    "Светотень / Оригинал / Вписать модель",
    "Sombreado / Original / Encuadrar modelo",
    "明暗 / 原始 / 适配模型"
  ],
  [
    "Build related color palette",
    "Создать палитру близких цветов",
    "Crear paleta de colores relacionados",
    "生成相关色调板"
  ],
  [
    "Smaller / larger brush or stamp",
    "Уменьшить / увеличить кисть или штамп",
    "Reducir / ampliar pincel o sello",
    "缩小 / 放大画笔或印章"
  ],
  [
    "Lower / raise softness or Blend strength",
    "Меньше / больше мягкости или силы смешивания",
    "Reducir / aumentar suavidad o mezcla",
    "降低 / 增加柔边或混合强度"
  ],
  [
    "Mirror the selected UVs",
    "Отразить выбранные UV",
    "Reflejar UV seleccionadas",
    "镜像选中的 UV"
  ],
  [
    "R (hold)",
    "R (удерживать)",
    "R (mantener)",
    "R（按住）"
  ],
  [
    "Start outside the edge; selection stays protected",
    "Начать за краем; выделение защищает остальное",
    "Empezar fuera del borde; la selección sigue protegida",
    "从边缘外开始，选区外仍受保护"
  ],
  [
    "Rotate stamp -15 / +15 / mirror",
    "Повернуть штамп -15 / +15 / отразить",
    "Girar sello -15 / +15 / reflejar",
    "印章旋转 -15 / +15 / 镜像"
  ],
  [
    "Full image / Texture / Highlights",
    "Всё изображение / Фактура / Блики",
    "Imagen completa / Textura / Luces",
    "完整图像 / 质感 / 高光"
  ],
  [
    "Round / Soft / Pencil / Chisel / Speckle",
    "Круглая / Мягкая / Карандаш / Плоская / Крапинки",
    "Redondo / Suave / Lápiz / Plano / Moteado",
    "圆形 / 柔边 / 铅笔 / 扁头 / 斑点"
  ],
  [
    "Copy selection / paste as stamp",
    "Копировать выделение / вставить штампом",
    "Copiar selección / pegar como sello",
    "复制选区 / 粘贴为印章"
  ],
  [
    "Cut a patch from the texture",
    "Вырезать фрагмент текстуры",
    "Recortar parte de la textura",
    "裁剪纹理的一部分"
  ],
  [
    "Copy and erase active paint in selection",
    "Копировать и стереть краску активного слоя",
    "Copiar y borrar pintura de la capa activa",
    "复制并擦除当前图层的选中内容"
  ],
  [
    "Cut source / Keep source",
    "Вырезать источник / Сохранить источник",
    "Recortar fuente / Guardar fuente",
    "裁剪来源 / 保存来源"
  ],
  [
    "Adjust UVs / Select pixels / UV mesh / Fit texture",
    "Править UV / Выбрать пиксели / UV-сетка / Вписать текстуру",
    "Editar UV / Seleccionar píxeles / Malla UV / Ajustar textura",
    "调整 UV / 选择像素 / UV 网格 / 适配纹理"
  ],
  [
    "Give the active part independent UVs",
    "Дать активной части отдельные UV",
    "Dar UV propias a la parte activa",
    "为当前部位分配独立 UV"
  ],
  [
    "Alt + left drag",
    "Alt + левая кнопка",
    "Alt + arrastrar con botón izquierdo",
    "Alt + 左键拖动"
  ],
  [
    "Rotate model",
    "Вращать модель",
    "Girar modelo",
    "旋转模型"
  ],
  [
    "Wheel / Right drag",
    "Колесо / Правая кнопка",
    "Rueda / Arrastrar con botón derecho",
    "滚轮 / 右键拖动"
  ],
  [
    "Zoom / pan texture views",
    "Масштаб / сдвиг текстуры",
    "Zoom / desplazar textura",
    "缩放 / 平移纹理视图"
  ],
  [
    "Fill selection",
    "Залить выделение",
    "Rellenar selección",
    "填充选区"
  ],
  [
    "Undo / redo",
    "Отменить / повторить",
    "Deshacer / rehacer",
    "撤销 / 重做"
  ],
  [
    "Save / Open / New paint project",
    "Сохранить / Открыть / Новый проект",
    "Guardar / Abrir / Nuevo proyecto",
    "保存 / 打开 / 新建绘画项目"
  ],
  [
    "Export / Use paint on model",
    "Экспорт / Применить к модели",
    "Exportar / Aplicar al modelo",
    "导出 / 将绘画应用到模型"
  ],
  [
    "WC3 library / Import image",
    "Библиотека WC3 / Импорт картинки",
    "Biblioteca WC3 / Importar imagen",
    "WC3 素材库 / 导入图像"
  ],
  [
    "Show this shortcut guide",
    "Показать эту памятку клавиш",
    "Mostrar esta guía de atajos",
    "显示快捷键指南"
  ],
  [
    "Painting tools",
    "Инструменты рисования",
    "Herramientas de pintura",
    "绘画工具"
  ],
  [
    "Erase",
    "Ластик",
    "Borrar",
    "擦除"
  ],
  [
    "Outlines",
    "Контуры",
    "Contornos",
    "轮廓"
  ],
  [
    "Colorfy",
    "Цвета частей",
    "Colorear partes",
    "部位着色"
  ],
  [
    "Original",
    "Оригинал",
    "Original",
    "原始"
  ],
  [
    "Frame model (Home)",
    "Вписать модель (Home)",
    "Encuadrar modelo (Home)",
    "适配模型 (Home)"
  ],
  [
    "Frame model",
    "Вписать модель",
    "Encuadrar modelo",
    "适配模型"
  ],
  [
    "Part",
    "Часть",
    "Parte",
    "部位"
  ],
  [
    "Geoset",
    "Геосет",
    "Geoset",
    "几何组"
  ],
  [
    "Faces",
    "Грани",
    "Caras",
    "面"
  ],
  [
    "Invert selection",
    "Инвертировать выделение",
    "Invertir selección",
    "反选"
  ],
  [
    "Protect pixels",
    "Защитить пиксели",
    "Proteger píxeles",
    "保护像素"
  ],
  [
    "Hold to paint from outside the edge",
    "Держите для рисования из-за края",
    "Mantén para pintar desde fuera",
    "按住可从边缘外绘画"
  ],
  [
    "Keep",
    "Сохранить",
    "Guardar",
    "保存素材"
  ],
  [
    "Borrow",
    "Взять из источника",
    "Tomar de la fuente",
    "借用来源"
  ],
  [
    "Full image",
    "Всё изображение",
    "Imagen completa",
    "完整图像"
  ],
  [
    "Highlights",
    "Блики",
    "Luces",
    "高光"
  ],
  [
    "Pick color (I)",
    "Пипетка (I)",
    "Tomar color (I)",
    "吸取颜色 (I)"
  ],
  [
    "Pick color from model",
    "Взять цвет с модели",
    "Tomar color del modelo",
    "从模型吸取颜色"
  ],
  [
    "Related colors",
    "Близкие цвета",
    "Colores relacionados",
    "相关色调"
  ],
  [
    "Related color palette",
    "Палитра близких цветов",
    "Paleta de colores relacionados",
    "相关色调板"
  ],
  [
    "Color gradient",
    "Цветовой градиент",
    "Gradiente de color",
    "颜色渐变"
  ],
  [
    "Brush shapes",
    "Формы кисти",
    "Formas de pincel",
    "画笔形状"
  ],
  [
    "Rotation",
    "Поворот",
    "Rotación",
    "旋转"
  ],
  [
    "Blend strength",
    "Сила смешивания",
    "Intensidad de mezcla",
    "混合强度"
  ],
  [
    "Separate this part",
    "Отделить пиксели части",
    "Separar píxeles de esta parte",
    "分离此部位的像素"
  ],
  [
    "Give the active part its own texture pixels so shared faces stop changing together (Ctrl+J)",
    "Дать части свои пиксели, чтобы общие грани не менялись вместе (Ctrl+J)",
    "Asigna píxeles propios para no pintar también las caras compartidas (Ctrl+J)",
    "为当前部位分配独立像素，避免共用像素的面一起改变 (Ctrl+J)"
  ],
  [
    "Destination texture",
    "Целевая текстура",
    "Textura de destino",
    "目标纹理"
  ],
  [
    "Paint layer",
    "Слой краски",
    "Capa de pintura",
    "颜料图层"
  ],
  [
    "Resize paint views",
    "Размер областей рисования",
    "Tamaño de vistas de pintura",
    "调整绘画视图大小"
  ],
  [
    "Outside edge · selection stays protected",
    "За краем · выделение защищает остальное",
    "Fuera del borde · selección protegida",
    "边缘外绘画 · 选区外受保护"
  ],
  [
    "Select parts · Q returns to brush",
    "Выбор частей · Q вернёт кисть",
    "Seleccionar partes · Q vuelve al pincel",
    "选择部位 · Q 返回画笔"
  ],
  [
    "Colorfy · view only",
    "Цвета частей · только просмотр",
    "Colorear partes · solo vista",
    "部位着色 · 仅影响视图"
  ],
  [
    "Selection protects the rest",
    "Выделение защищает остальное",
    "La selección protege el resto",
    "选区外受保护"
  ],
  [
    "Whole model",
    "Вся модель",
    "Todo el modelo",
    "整个模型"
  ],
  [
    "Begin painting",
    "Начать рисовать",
    "Empezar a pintar",
    "开始绘画"
  ],
  [
    "Undo (Ctrl+Z)",
    "Отменить (Ctrl+Z)",
    "Deshacer (Ctrl+Z)",
    "撤销 (Ctrl+Z)"
  ],
  [
    "Undo paint",
    "Отменить рисование",
    "Deshacer pintura",
    "撤销绘画"
  ],
  [
    "Redo (Ctrl+Y)",
    "Повторить (Ctrl+Y)",
    "Rehacer (Ctrl+Y)",
    "重做 (Ctrl+Y)"
  ],
  [
    "Redo paint",
    "Повторить рисование",
    "Rehacer pintura",
    "重做绘画"
  ],
  [
    "· Unsaved",
    "· Не сохранено",
    "· Sin guardar",
    "· 未保存"
  ],
  [
    "Open…",
    "Открыть…",
    "Abrir…",
    "打开…"
  ],
  [
    "Save project",
    "Сохранить проект",
    "Guardar proyecto",
    "保存项目"
  ],
  [
    "Export…",
    "Экспорт…",
    "Exportar…",
    "导出…"
  ],
  [
    "Use paint on model",
    "Применить к модели",
    "Aplicar al modelo",
    "将绘画应用到模型"
  ],
  [
    "Paint shortcuts",
    "Клавиши рисования",
    "Atajos de pintura",
    "绘画快捷键"
  ],
  [
    "Where to work",
    "Где рисуем",
    "Dónde pintar",
    "绘画范围"
  ],
  [
    "add ·",
    "добавить ·",
    "añadir ·",
    "添加 ·"
  ],
  [
    "subtract",
    "вычесть",
    "restar",
    "减去"
  ],
  [
    "Choose an image from the shelf.",
    "Выберите изображение на полке.",
    "Elige una imagen de la estantería.",
    "从素材架选择图像。"
  ],
  [
    "Shadow · midtone · highlight",
    "Тень · основной тон · блик",
    "Sombra · tono medio · luz",
    "阴影 · 中间色 · 高光"
  ],
  [
    "Layers & texture",
    "Слои и текстура",
    "Capas y textura",
    "图层与纹理"
  ],
  [
    "Show layer",
    "Показать слой",
    "Mostrar capa",
    "显示图层"
  ],
  [
    "Resize texture…",
    "Размер текстуры…",
    "Cambiar tamaño…",
    "调整纹理大小…"
  ],
  [
    "Paint your model, borrow Warcraft textures, and mix them together.",
    "Рисуйте на модели, берите текстуры Warcraft и смешивайте их.",
    "Pinta tu modelo, toma texturas de Warcraft y combínalas.",
    "在模型上绘画，借用魔兽纹理并自由组合。"
  ],
  [
    "Edit the texture",
    "Изменить текстуру",
    "Editar textura",
    "编辑纹理"
  ],
  [
    "Start with the skin already on your model.",
    "Начните с исходной текстуры модели.",
    "Empieza con la textura actual del modelo.",
    "从模型现有纹理开始。"
  ],
  [
    "New base coat",
    "Новая основа",
    "Nueva capa base",
    "新建底色"
  ],
  [
    "Start with a clean surface and paint your own.",
    "Начните с чистой поверхности и рисуйте своё.",
    "Empieza con una superficie limpia y pinta lo que quieras.",
    "从干净的表面开始自由绘画。"
  ],
  [
    "Texture detail",
    "Детализация текстуры",
    "Detalle de textura",
    "纹理精度"
  ],
  [
    "512 px · Standard",
    "512 пкс · Обычная",
    "512 px · Estándar",
    "512 px · 标准"
  ],
  [
    "1024 px · Fine detail",
    "1024 пкс · Высокая",
    "1024 px · Más detalle",
    "1024 px · 精细"
  ],
  [
    "Native · Exact pixel work",
    "Исходный размер · Пиксель в пиксель",
    "Tamaño nativo · Píxel exacto",
    "原始尺寸 · 精确像素"
  ],
  [
    "The skin keeps its layout. Only your working copy changes.",
    "Развёртка сохраняется. Меняется только рабочая копия.",
    "Se conserva la distribución. Solo cambia la copia de trabajo.",
    "保留纹理布局。仅修改工作副本。"
  ],
  [
    "Open project…",
    "Открыть проект…",
    "Abrir proyecto…",
    "打开项目…"
  ],
  [
    "Adjust mapping",
    "Править развёртку",
    "Editar mapeado",
    "调整映射"
  ],
  [
    "Drag selected faces",
    "Перетаскивайте выбранные грани",
    "Arrastra las caras seleccionadas",
    "拖动选中的面"
  ],
  [
    "Drag this geoset",
    "Перетаскивайте этот геосет",
    "Arrastra este geoset",
    "拖动此几何组"
  ],
  [
    "Paint region mask",
    "Маска области рисования",
    "Máscara de pintura",
    "绘画区域蒙版"
  ],
  [
    "UVs",
    "UV",
    "UV",
    "UV"
  ],
  [
    "Pixels",
    "Пиксели",
    "Píxeles",
    "像素"
  ],
  [
    "Mesh",
    "Сетка",
    "Malla",
    "网格"
  ],
  [
    "Cut patch",
    "Вырезать фрагмент",
    "Recortar parte",
    "裁剪图块"
  ],
  [
    "Mirror UVs",
    "Отразить UV",
    "Reflejar UV",
    "镜像 UV"
  ],
  [
    "Paint material",
    "Материал рисования",
    "Material de pintura",
    "绘画材质"
  ],
  [
    "Create new material",
    "Создать материал",
    "Crear material",
    "创建材质"
  ],
  [
    "Create material from texture",
    "Создать материал из текстуры",
    "Crear material desde textura",
    "从纹理创建材质"
  ],
  [
    "Paint destination",
    "Куда рисовать",
    "Destino de pintura",
    "绘画目标"
  ],
  [
    "Use for whole model",
    "Для всей модели",
    "Usar en todo el modelo",
    "用于整个模型"
  ],
  [
    "Open the desktop editor and connect Warcraft III data to use native sources.",
    "Откройте настольный редактор и подключите данные Warcraft III.",
    "Abre el editor de escritorio y conecta los datos de Warcraft III.",
    "请打开桌面编辑器并连接魔兽争霸 III 数据。"
  ],
  [
    "This source is unavailable in your configured Warcraft III data.",
    "Источник недоступен в выбранных данных Warcraft III.",
    "La fuente no está disponible en los datos de Warcraft III configurados.",
    "当前配置的魔兽争霸 III 数据中没有此来源。"
  ],
  [
    "Loading…",
    "Загрузка…",
    "Cargando…",
    "正在加载…"
  ],
  [
    "Crop selected palette texture",
    "Вырезать из выбранной текстуры",
    "Recortar textura seleccionada",
    "裁剪选中的素材纹理"
  ],
  [
    "Find texture…",
    "Найти текстуру…",
    "Buscar textura…",
    "查找纹理…"
  ],
  [
    "Texture shelf",
    "Полка текстур",
    "Estantería de texturas",
    "纹理素材架"
  ],
  [
    "From file…",
    "Из файла…",
    "Desde archivo…",
    "从文件…"
  ],
  [
    "5 starters",
    "5 примеров",
    "5 ejemplos",
    "5 个入门素材"
  ],
  [
    "My library",
    "Моя библиотека",
    "Mi biblioteca",
    "个人素材库"
  ],
  [
    "Your own texture collection. Import an image or cut a piece from Warcraft, then choose Keep.",
    "Ваша коллекция текстур. Импортируйте изображение или вырежьте фрагмент Warcraft и нажмите «Сохранить».",
    "Tu colección de texturas. Importa una imagen o recorta una parte de Warcraft y pulsa Guardar.",
    "你的纹理收藏。导入图像或裁剪魔兽纹理，然后选择保存素材。"
  ],
  [
    "Texture has no image data",
    "В текстуре нет изображения",
    "La textura no contiene imagen",
    "纹理没有图像数据"
  ],
  [
    "The graphics context was lost. Reload the editor to restore the viewport. Save your work first.",
    "Графический контекст потерян. Сохраните работу и перезагрузите редактор.",
    "Se perdió el contexto gráfico. Guarda tu trabajo y recarga el editor.",
    "图形上下文已丢失。请先保存，再重新加载编辑器。"
  ],
  [
    "3D model viewport",
    "Окно 3D-модели",
    "Vista del modelo 3D",
    "3D 模型视图"
  ],
  [
    "Material 1",
    "Материал 1",
    "Material 1",
    "材质 1"
  ],
  [
    "Ready. Paint on the model, or choose an image from the shelf.",
    "Готово. Рисуйте на модели или выберите картинку на полке.",
    "Listo. Pinta en el modelo o elige una imagen de la estantería.",
    "已就绪。在模型上绘画，或从素材架选择图像。"
  ],
  [
    "Click parts to select. Shift adds; Ctrl subtracts. Q returns to the brush.",
    "Выбирайте части щелчком. Shift добавляет, Ctrl вычитает. Q вернёт кисть.",
    "Haz clic para seleccionar partes. Shift añade; Ctrl resta. Q vuelve al pincel.",
    "点击选择部位。Shift 添加，Ctrl 减去。Q 返回画笔。"
  ],
  [
    "Paint on the model or texture. Shift adds to selection; Ctrl subtracts.",
    "Рисуйте на модели или текстуре. Shift добавляет к выделению, Ctrl вычитает.",
    "Pinta sobre el modelo o textura. Shift añade a la selección; Ctrl resta.",
    "在模型或纹理上绘画。Shift 添加到选区，Ctrl 减去。"
  ],
  [
    "Blend the colors under the brush. Strength limits the whole stroke.",
    "Смешивайте цвета под кистью. Сила ограничивает весь мазок.",
    "Mezcla los colores bajo el pincel. La intensidad limita todo el trazo.",
    "混合画笔下的颜色。强度限制作用于整条笔画。"
  ],
  [
    "Click the model or texture to pick its color.",
    "Нажмите на модель или текстуру, чтобы взять цвет.",
    "Haz clic en el modelo o textura para tomar su color.",
    "点击模型或纹理吸取颜色。"
  ],
  [
    "Erase the active paint layer to reveal the skin beneath.",
    "Стирайте активный слой, открывая текстуру под ним.",
    "Borra la capa activa para revelar la textura inferior.",
    "擦除当前图层，露出下方纹理。"
  ],
  [
    "Painted patch",
    "Нарисованный фрагмент",
    "Recorte pintado",
    "已绘制图块"
  ],
  [
    "Copied painted pixels. Select a destination or Ctrl+D to clear, then Ctrl+V to stamp.",
    "Пиксели скопированы. Выберите место или снимите выделение (Ctrl+D), затем вставьте штамп (Ctrl+V).",
    "Píxeles copiados. Elige un destino o limpia con Ctrl+D; pega el sello con Ctrl+V.",
    "像素已复制。选择目标或按 Ctrl+D 清除选区，然后按 Ctrl+V 粘贴为印章。"
  ],
  [
    "Copy a painted selection or cut a texture patch first.",
    "Сначала скопируйте выделенное или вырежьте фрагмент.",
    "Primero copia una selección pintada o recorta una textura.",
    "请先复制已绘制选区，或裁剪纹理图块。"
  ],
  [
    "Choose a texture from the shelf first.",
    "Сначала выберите текстуру на полке.",
    "Primero elige una textura de la estantería.",
    "请先从素材架选择纹理。"
  ],
  [
    "Choose a face inside the paint region.",
    "Выберите грань внутри области рисования.",
    "Elige una cara dentro de la zona de pintura.",
    "请选择绘画区域内的面。"
  ],
  [
    "Resize paint destination",
    "Изменить размер области рисования",
    "Cambiar tamaño del destino",
    "调整绘画目标大小"
  ],
  [
    "Texture resized. Undo restores its original resolution.",
    "Размер текстуры изменён. Отмена вернёт прежний размер.",
    "Textura redimensionada. Deshacer restaura su tamaño.",
    "纹理大小已更改。撤销可恢复原始分辨率。"
  ],
  [
    "Make selection independent",
    "Отделить пиксели выделения",
    "Independizar selección",
    "分离选区像素"
  ],
  [
    "Selection has its own paint pixels. The skin layout and geosets stay together. Undo restores shared painting.",
    "У выделения теперь свои пиксели. Развёртка и геосеты сохранены. Отмена вернёт общие пиксели.",
    "La selección tiene píxeles propios. Se conservan distribución y geosets. Deshacer restaura los píxeles compartidos.",
    "选区现在拥有独立像素。纹理布局和几何组保持完整。撤销可恢复共用像素。"
  ],
  [
    "Fill selected pixels",
    "Залить выбранные пиксели",
    "Rellenar píxeles seleccionados",
    "填充选中的像素"
  ],
  [
    "Filled the selection with color.",
    "Выделение залито цветом.",
    "Selección rellenada con color.",
    "已用颜色填充选区。"
  ],
  [
    "Move selected UVs",
    "Переместить выбранные UV",
    "Mover UV seleccionadas",
    "移动选中的 UV"
  ],
  [
    "Resize texture",
    "Размер текстуры",
    "Tamaño de textura",
    "调整纹理大小"
  ],
  [
    "Resizing…",
    "Изменение размера…",
    "Redimensionando…",
    "正在调整大小…"
  ],
  [
    "Longest side",
    "Длинная сторона",
    "Lado más largo",
    "最长边"
  ],
  [
    "Keeps the current layout. More pixels allow finer new brushwork; your existing artwork stays intact.",
    "Сохраняет развёртку. Больше пикселей — тоньше новые мазки; прежний рисунок остаётся.",
    "Conserva la distribución. Más píxeles permiten trazos más finos; se conserva tu trabajo.",
    "保留当前布局。更多像素可绘制更精细的新笔画；已有作品保持完整。"
  ],
  [
    "This changes the working copy and can be undone.",
    "Меняется рабочая копия. Действие можно отменить.",
    "Cambia la copia de trabajo y se puede deshacer.",
    "仅修改工作副本，可撤销。"
  ],
  [
    "Finish the outline first: Enter. Esc cancels it.",
    "Сначала замкните контур: Enter. Esc отменяет.",
    "Termina el contorno con Enter. Esc lo cancela.",
    "请先按 Enter 完成轮廓。Esc 取消。"
  ],
  [
    "Bright area = selected. Dark area = protected.",
    "Светлое = выделено. Тёмное = защищено.",
    "Claro = seleccionado. Oscuro = protegido.",
    "亮色区域已选中，暗色区域受保护。"
  ],
  [
    "Use paint region",
    "Использовать область",
    "Usar zona de pintura",
    "使用绘画区域"
  ],
  [
    "% selected",
    "% выделено",
    "% seleccionado",
    "% 已选中"
  ],
  [
    "Outside-edge painting active",
    "Рисование из-за края включено",
    "Pintura desde fuera activa",
    "已启用边缘外绘画"
  ],
  [
    "Blend brush / Pick color",
    "Смешивание / Пипетка",
    "Mezclar / Tomar color",
    "混合画笔 / 吸取颜色"
  ],
  [
    "Lower / raise opacity",
    "Уменьшить / увеличить непрозрачность",
    "Reducir / aumentar opacidad",
    "降低 / 增加不透明度"
  ],
  [
    "Brush ready. Shift adds to selection; Ctrl subtracts.",
    "Кисть готова. Shift добавляет к выделению; Ctrl вычитает.",
    "Pincel listo. Shift añade a la selección; Ctrl resta.",
    "画笔已就绪。Shift 添加到选区，Ctrl 减去。"
  ],
  [
    "Click to stamp; drag while pressed to position. , / . rotate, M mirrors, [ ] changes size. Hold R to start outside the edge.",
    "Щелчок ставит штамп; удерживая, двигайте. , / . — поворот, M — зеркало, [ ] — размер. Держите R для старта за краем.",
    "Clic para estampar; arrastra para colocar. , / . giran, M refleja, [ ] cambia tamaño. Mantén R para empezar fuera.",
    "点击盖章；按住拖动调整位置。, / . 旋转，M 镜像，[ ] 调整大小。按住 R 可从边缘外开始。"
  ],
  [
    "Alt-drag: rotate · Right-drag: {0} · Wheel: zoom · Shift add / Ctrl subtract",
    "Alt + тяга: вращать · Правая кнопка: {0} · Колесо: масштаб · Shift добавить / Ctrl вычесть",
    "Alt + arrastrar: girar · Botón derecho: {0} · Rueda: zoom · Shift añade / Ctrl resta",
    "Alt 拖动：旋转 · 右键拖动：{0} · 滚轮：缩放 · Shift 添加 / Ctrl 减去"
  ],
  [
    "pan",
    "сдвиг",
    "desplazar",
    "平移"
  ],
  [
    "rotate",
    "вращение",
    "girar",
    "旋转"
  ],
  [
    "zoom",
    "масштаб",
    "zoom",
    "缩放"
  ],
  [
    "Wheel zoom / Right-drag pan",
    "Колесо: масштаб / Правая кнопка: сдвиг",
    "Rueda: zoom / Botón derecho: desplazar",
    "滚轮缩放 / 右键拖动平移"
  ],
  [
    "% · Wheel zoom · Right-drag pan",
    "% · Колесо: масштаб · Правая кнопка: сдвиг",
    "% · Rueda: zoom · Botón derecho: desplazar",
    "% · 滚轮缩放 · 右键拖动平移"
  ],
  [
    "· Enter applies scale / rotation",
    "· Enter применяет масштаб / поворот",
    "· Enter aplica escala / rotación",
    "· Enter 应用缩放 / 旋转"
  ],
  [
    "Destination ·",
    "Назначение ·",
    "Destino ·",
    "目标 ·"
  ],
  [
    "Texture selection",
    "Выделение текстуры",
    "Selección de textura",
    "纹理选区"
  ],
  [
    "{0} face · {1} geoset",
    "{0} грань · {1} геосет",
    "{0} cara · {1} geoset",
    "{0} 个面 · {1} 个几何组"
  ],
  [
    "{0} faces · {1} geoset",
    "{0} граней · {1} геосет",
    "{0} caras · {1} geoset",
    "{0} 个面 · {1} 个几何组"
  ],
  [
    "{0} faces · {1} geosets",
    "{0} граней · {1} геосетов",
    "{0} caras · {1} geosets",
    "{0} 个面 · {1} 个几何组"
  ],
  [
    "{0} face · {1} geosets",
    "{0} грань · {1} геосетов",
    "{0} cara · {1} geosets",
    "{0} 个面 · {1} 个几何组"
  ],
  [
    "Geoset {0}",
    "Геосет {0}",
    "Geoset {0}",
    "几何组 {0}"
  ],
  [
    "Painting geoset {0}",
    "Рисование по геосету {0}",
    "Pintando geoset {0}",
    "正在绘制几何组 {0}"
  ],
  [
    "Filled geoset {0}. Undo restores the previous paint.",
    "Геосет {0} залит. Отмена вернёт прежнюю краску.",
    "Geoset {0} rellenado. Deshacer restaura la pintura anterior.",
    "已填充几何组 {0}。撤销可恢复先前绘画。"
  ],
  [
    "Lamp {0}",
    "Лампа {0}",
    "Luz {0}",
    "灯光 {0}"
  ],
  [
    "Related shade {0}: {1}",
    "Близкий оттенок {0}: {1}",
    "Tono relacionado {0}: {1}",
    "相关色调 {0}：{1}"
  ],
  [
    "{0} value",
    "{0}: значение",
    "Valor de {0}",
    "{0}值"
  ],
  [
    "{0} brush",
    "Кисть: {0}",
    "Pincel {0}",
    "{0}画笔"
  ],
  [
    "{0} ({1})",
    "{0} ({1})",
    "{0} ({1})",
    "{0} ({1})"
  ],
  [
    "Pencil",
    "Карандаш",
    "Lápiz",
    "铅笔"
  ],
  [
    "Chisel",
    "Плоская",
    "Plano",
    "扁头"
  ],
  [
    "Speckle",
    "Крапинки",
    "Moteado",
    "斑点"
  ],
  [
    "Brush size",
    "Размер кисти",
    "Tamaño de pincel",
    "画笔大小"
  ],
  [
    "Stamp size",
    "Размер штампа",
    "Tamaño de sello",
    "印章大小"
  ],
  [
    "Softness",
    "Мягкость",
    "Suavidad",
    "柔边"
  ],
  [
    "Preparing…",
    "Подготовка…",
    "Preparando…",
    "正在准备…"
  ],
  [
    "Texture · Destination",
    "Текстура · Назначение",
    "Textura · Destino",
    "纹理 · 目标"
  ],
  [
    "Source collection",
    "Коллекция источников",
    "Colección de fuentes",
    "来源集合"
  ],
  [
    "Footman chainmail",
    "Кольчуга пехотинца",
    "Cota de malla del soldado",
    "步兵锁子甲"
  ],
  [
    "Footman steel",
    "Сталь пехотинца",
    "Acero del soldado",
    "步兵钢甲"
  ],
  [
    "Silver plate",
    "Серебряная пластина",
    "Placa plateada",
    "银色甲片"
  ],
  [
    "Grunt skin",
    "Кожа бугая",
    "Piel de orco",
    "兽人步兵皮肤"
  ],
  [
    "Roof wood",
    "Дерево крыши",
    "Madera del tejado",
    "屋顶木材"
  ],
  [
    "{0} · Wheel zoom / Right-drag pan",
    "{0} · Колесо: масштаб / Правая кнопка: сдвиг",
    "{0} · Rueda: zoom / Botón derecho: desplazar",
    "{0} · 滚轮缩放 / 右键拖动平移"
  ],
  [
    "Base coat color",
    "Цвет основы",
    "Color de capa base",
    "底色颜色"
  ],
  [
    "Working size",
    "Рабочий размер",
    "Tamaño de trabajo",
    "工作尺寸"
  ],
  [
    "Fill selection with color",
    "Залить выделение цветом",
    "Rellenar selección con color",
    "用颜色填充选区"
  ],
  [
    "Riveted plate detail",
    "Пластина с заклёпками",
    "Placa con remaches",
    "铆钉甲片"
  ],
  [
    "Dark wood grain",
    "Тёмное дерево",
    "Veta de madera oscura",
    "深色木纹"
  ],
  [
    "Cut out",
    "Вырезать",
    "Recortar",
    "裁剪"
  ],
  [
    "· Wheel zoom / Right-drag pan",
    "· Колесо: масштаб / Правая кнопка: сдвиг",
    "· Rueda: zoom / Botón derecho: desplazar",
    "· 滚轮缩放 / 右键拖动平移"
  ]
  ,[
    "Paint preset unsaved ·",
    "Проект рисования не сохранён ·",
    "Proyecto de pintura sin guardar ·",
    "绘画项目未保存 ·"
  ]
];
export const paintSources=Object.freeze(rows.map(row=>row[0]));
export const paintRussian=Object.freeze(Object.fromEntries(rows.map(([en,ru])=>[en,ru])));
export const paintSpanish=Object.freeze(Object.fromEntries(rows.map(([en,,es])=>[en,es])));
export const paintChinese=Object.freeze(Object.fromEntries(rows.map(([en,,,zh])=>[en,zh])));
