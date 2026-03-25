import type { TaskPriority } from '@/lib/types/database.types'

export interface DefaultTask {
  name: string
  description: string
  priority: TaskPriority
  planned_cost?: number
  why_important: string
  what_if_skip: string
  pro_tip: string
  is_required: boolean
}

export interface DefaultStage {
  name: string
  sort_order: number
  planned_cost: number
  tasks: DefaultTask[]
}

export const DEFAULT_STAGES: DefaultStage[] = [
  {
    name: 'קרקע',
    sort_order: 1,
    planned_cost: 25000,
    tasks: [
      // שלב א׳: בדיקות משפטיות-רישומיות — לפני כל הוצאת כסף
      {
        name: 'בדיקת נסח טאבו והערות אזהרה',
        description: 'הוצאת נסח טאבו עדכני, בדיקת בעלות, שעבודים, עיקולים והערות',
        priority: 'critical',
        planned_cost: 200,
        why_important: 'זה הדבר הראשון שעושים — לפני כל הוצאה, לפני אדריכל, לפני כלום. חייבים לוודא שהקרקע נקייה',
        what_if_skip: 'קנייה של קרקע עם עיקולים, שעבודים, או בעלות שנויה במחלוקת — הפסד של מאות אלפים',
        pro_tip: 'הנסח עולה כמה עשרות שקלים באתר רשות המקרקעין. אל תסמוך על נסח שהמוכר מספק — הוצא בעצמך',
        is_required: true,
      },
      {
        name: 'בדיקת תב"ע ואחוזי בנייה',
        description: 'בדיקת תוכנית בניין עיר, ייעוד הקרקע, אחוזי בנייה מותרים, קווי בניין וגובה',
        priority: 'critical',
        planned_cost: 0,
        why_important: 'מה מותר לבנות, כמה קומות, כמה מטרים — הכל מוגדר בתב"ע. חייבים לדעת לפני שמתחילים לתכנן',
        what_if_skip: 'תכנון בית שלא ניתן לאשר, בזבוז כסף על תוכניות שיילכו לפח',
        pro_tip: 'בדוק עם הוועדה המקומית — הרבה פעמים יש תב"ע מפורטת בתהליך אישור שמשנה הכל',
        is_required: true,
      },
      {
        name: 'ייעוץ עורך דין מקרקעין',
        description: 'בדיקה משפטית של כל הממצאים, חוזה הרכישה וזכויות הבעלות',
        priority: 'critical',
        planned_cost: 8000,
        why_important: 'עסקת נדל"ן בלי עורך דין = סיכון של מאות אלפים. הוא קורא מה שאתה לא יודע לקרוא',
        what_if_skip: 'עלולות להיות בעיות בעלות, חובות, שעבודים, הסכמים מוקדמים שלא ידעת',
        pro_tip: 'תשלם על זה — זה הדבר הזול ביותר בפרויקט שיציל אותך הכי הרבה. שכר טרחה רגיל: 0.5%-1% מעסקה',
        is_required: true,
      },
      {
        name: 'הבנת תשלומי רמ"י (אם רלוונטי)',
        description: 'בדיקת חובת היוון, דמי היתר, דמי שימוש ועלויות רשות מקרקעי ישראל',
        priority: 'high',
        planned_cost: 0,
        why_important: 'רמ"י מנהל ~90% מהקרקעות בישראל. אם הקרקע בחכירה — צריך לשלם דמי היוון לפני שמקבלים היתר',
        what_if_skip: 'הפתעות של עשרות עד מאות אלפי שקלים בדמי היתר (33% משווי ההשבחה)',
        pro_tip: 'שאל את עורך הדין: האם הקרקע מוחכרת? צריך להיוון? כמה זה? זה יכול לשנות לחלוטין את כדאיות הפרויקט',
        is_required: false,
      },
      // שלב ב׳: בדיקות פיזיות-הנדסיות — אחרי שהמצב המשפטי ברור
      {
        name: 'ייעוץ שמאי מקרקעין',
        description: 'הערכת שווי הנכס ובדיקת כדאיות כלכלית לפרויקט',
        priority: 'normal',
        planned_cost: 2500,
        why_important: 'שמאי ייאמר לך מה שווה הקרקע, מה שווה הבית לאחר הבנייה, ומה ה-ROI הצפוי',
        what_if_skip: 'עלול לשלם יתר על הקרקע, או לגלות שהפרויקט לא כדאי כלכלית רק אחרי שהשקעת הרבה',
        pro_tip: 'הבנק ידרוש שמאות בכל מקרה לצורך המשכנתא — כדאי להזמין בשלב מוקדם',
        is_required: false,
      },
      {
        name: 'בדיקת גבולות ומדידת הגוש/חלקה',
        description: 'הזמנת מודד מוסמך לסימון גבולות המגרש ועריכת תצלום מצב',
        priority: 'critical',
        planned_cost: 4000,
        why_important: 'בלי מדידה מדויקת — אתה יכול לבנות על שטח של שכן ולא לדעת. המדידה קובעת את "מסגרת" הבנייה',
        what_if_skip: 'תביעות משפטיות יקרות, צווי הריסה, עיכוב של שנים',
        pro_tip: 'בקש תצלום מצב מהמודד — זה מסמך שהאדריכל יצטרך. מודד מוסמך = מודד מוסמך רשאי לפי חוק',
        is_required: true,
      },
      {
        name: 'בדיקה גאוטכנית (בדיקת קרקע)',
        description: 'בדיקת יציבות, סוג ואיכות הקרקע ליסודות על ידי מהנדס גאוטכניקה',
        priority: 'critical',
        planned_cost: 6000,
        why_important: 'קרקע גירית, חרסיתית, או קרקע מילוי = יסודות יקרים פי 3. בלי בדיקה תתגלה הבעיה בשלד',
        what_if_skip: 'חריגה תקציבית ענקית, עיכוב בבנייה, סיכון בטיחותי, בנק לא יאשר משכנתא',
        pro_tip: 'דרוש דוח גאוטכניקה כתוב — זה מסמך חובה לבנק ולמהנדס הקונסטרוקציה',
        is_required: true,
      },
      {
        name: 'בדיקת תשתיות קיימות (מים, ביוב, חשמל)',
        description: 'בדיקה מול חברות תשתית: מיקום חיבורים קיימים, עלויות חיבור, מרחק מהמגרש',
        priority: 'high',
        planned_cost: 500,
        why_important: 'חיבור מים/חשמל/ביוב שנמצא רחוק מהמגרש יכול לעלות עשרות אלפים לא מתוכננים',
        what_if_skip: 'הפתעות תקציביות גדולות בשלב הגמר — כשאי אפשר לסגת',
        pro_tip: 'פנה ל-חברת החשמל, מקורות/תאגיד המים, ורשות הניקוז בנפרד. כל אחד יספק מפה של תשתיות קיימות',
        is_required: true,
      },
    ],
  },
  {
    name: 'היתר בנייה',
    sort_order: 2,
    planned_cost: 80000,
    tasks: [
      {
        name: 'בחירת אדריכל',
        description: 'מציאת אדריכל מוסמך, ראיית פרויקטים קודמים, עריכת הסכם עבודה',
        priority: 'critical',
        planned_cost: 3000,
        why_important: 'האדריכל הוא מי שיתכנן את הבית שלך — הבחירה הכי חשובה בשלב הזה',
        what_if_skip: 'לא ניתן להגיש לוועדה בלי אדריכל מוסמך',
        pro_tip: 'ראה לפחות 3 פרויקטים שביצע. שאל על זמני אספקה — אדריכלים עמוסים מאחרים חודשים. שאל מי המפקח מטעמו',
        is_required: true,
      },
      {
        name: 'בחירת מהנדס קונסטרוקציה',
        description: 'מציאת מהנדס מבנה מוסמך לתכנון יסודות, שלד ופתחים',
        priority: 'critical',
        planned_cost: 5000,
        why_important: 'המהנדס קובע את בטיחות הבית. תוכניות הקונסטרוקציה נדרשות להגשת היתר',
        what_if_skip: 'לא ניתן לקבל היתר, ולא ניתן לבנות שלד בטוח',
        pro_tip: 'כדאי לבחור מהנדס שעובד בשיתוף עם האדריכל — תיאום ביניהם חוסך זמן ובעיות',
        is_required: true,
      },
      {
        name: 'עריכת תוכנית אדריכלית',
        description: 'שרטוט תוכניות הבית: חזיתות, חתכים, פרספקטיבה, קווי בניין',
        priority: 'critical',
        planned_cost: 25000,
        why_important: 'זה הבסיס לכל הפרויקט — שינויים לאחר אישור ועדה עולים כפול ולוקחים חודשים',
        what_if_skip: 'לא ניתן להגיש היתר',
        pro_tip: 'השקע זמן בשלב הזה. כל שינוי בשלד יעלה 5-10 פעמים יותר. חשוב על הבית שאתה רוצה בעוד 10 שנים',
        is_required: true,
      },
      {
        name: 'תוכניות קונסטרוקציה (מהנדס)',
        description: 'תכנון הנדסי: יסודות, עמודים, קורות, תקרות — לפי תוצאות הגאוטכניקה',
        priority: 'critical',
        planned_cost: 15000,
        why_important: 'ועדת הבנייה דורשת תוכניות קונסטרוקציה חתומות. בלעדיהן לא ניתן לקבל היתר',
        what_if_skip: 'לא ניתן לקבל היתר ולא ניתן לבנות',
        pro_tip: 'ודא שהמהנדס מכיר את תוצאות הגאוטכניקה — זה ישפיע ישירות על עלויות היסודות',
        is_required: true,
      },
      {
        name: 'תוכניות אינסטלציה וחשמל להגשה',
        description: 'תוכניות שרברבות וחשמל בסיסיות כנדרש להגשת היתר',
        priority: 'high',
        planned_cost: 5000,
        why_important: 'ועדות רבות דורשות תוכניות תשתיות להגשה — בדוק מה דורשת הוועדה שלך',
        what_if_skip: 'הגשה חסרה = עיכוב בטיפול. בחלק מהוועדות הגשה בלי תוכניות אינה מתקבלת',
        pro_tip: 'אלו לא תוכניות הביצוע הסופיות — רק לצרכי היתר. תוכניות הביצוע המפורטות יהיו בשלב הגמר',
        is_required: false,
      },
      {
        name: 'הגשה לוועדה המקומית + תשלום אגרות',
        description: 'הגשת כל המסמכים לוועדה, תשלום אגרת בקשה ואגרת היתר',
        priority: 'critical',
        planned_cost: 8000,
        why_important: 'ההיתר הוא אישור חוקי לבנות. בלעדיו הבנייה פלילית ממש',
        what_if_skip: 'צווי הריסה, קנסות, בלי אפשרות לחבר חשמל/מים, בעיות עם הבנק',
        pro_tip: 'בדוק ממוצע זמן טיפול בוועדה שלך — יש ועדות שלוקחות 6-18 חודש. זה הזמן לסגור פינות בפרויקט',
        is_required: true,
      },
      {
        name: 'טיפול בהתנגדויות שכנים',
        description: 'מענה להתנגדויות שמגישים שכנים לבקשה',
        priority: 'normal',
        planned_cost: 5000,
        why_important: 'התנגדות לא מטופלת יכולה לעכב ב-6-12 חודשים ויותר',
        what_if_skip: 'עיכוב משמעותי בהיתר, לעתים דחייה של הבקשה',
        pro_tip: 'דבר עם השכנים לפני ההגשה ולפני שחותמים — הרבה פעמים זה פותר הכל בשיחה ישירה',
        is_required: false,
      },
      {
        name: 'קבלת היתר הבנייה',
        description: 'קבלת ההיתר הסופי מהוועדה, קריאה ובדיקת תנאים',
        priority: 'critical',
        planned_cost: 0,
        why_important: 'זה הרגע הרשמי שמותר להתחיל לבנות. אין היתר = אין בנייה',
        what_if_skip: 'אי אפשר לדלג — זה שלב חוקי חובה',
        pro_tip: 'קרא את ההיתר לפרטיו לפני שחותמים — ודא שמה שמותר תואם לתוכנית שלך. אם יש תנאים — הבן אותם',
        is_required: true,
      },
    ],
  },
  {
    name: 'שלד',
    sort_order: 3,
    planned_cost: 400000,
    tasks: [
      // מינוי אנשי מקצוע לפני כל עבודה
      {
        name: 'שכירת מפקח בנייה',
        description: 'מינוי מפקח מוסמך שיפקח על כל שלבי הבנייה מטעם הלקוח',
        priority: 'critical',
        planned_cost: 20000,
        why_important: 'המפקח הוא "עיניים שלך באתר". הוא רואה טעויות לפני שהן נקבעות בבטון. הבנק מחייב מפקח',
        what_if_skip: 'הבנק לא ישחרר כספי משכנתא. טעויות לא יתגלו בזמן ויעלו פי 10 לתיקון',
        pro_tip: 'המפקח לא עובד עבור הקבלן — הוא עובד עבורך. בחר מפקח שאינו קשור לקבלן שלך',
        is_required: true,
      },
      {
        name: 'בחירת קבלן שלד וחתימת חוזה',
        description: 'קבלת הצעות מחיר, בחירת קבלן, עריכת חוזה מפורט עם לוח זמנים ועונשים',
        priority: 'critical',
        planned_cost: 5000,
        why_important: 'קבלן שלד גרוע = בית לא בטוח. החוזה קובע מה קורה אם יש עיכובים או ליקויים',
        what_if_skip: 'אין קבלן = אין שלד. בלי חוזה — אין לך הגנה משפטית',
        pro_tip: 'טעות נפוצה: בחירה לפי מחיר בלבד. בדוק 3 פרויקטים שסיים + שאל מפקח שעבד איתו. חוזה חייב לכלול לוח תשלומים מול אבני דרך',
        is_required: true,
      },
      // עבודות בשטח — לפי הסדר הכרונולוגי
      {
        name: 'עבודות עפר ופינוי',
        description: 'חפירה, יישור שטח, פינוי פסולת ועצים, הכנת הקרקע ליסודות',
        priority: 'high',
        planned_cost: 35000,
        why_important: 'הכנת הקרקע ליסודות — שלב קריטי שמשפיע על כל מה שבא אחריו',
        what_if_skip: 'אי אפשר לדלג — לא ניתן ליצוק יסודות בקרקע לא מוכנה',
        pro_tip: 'אם מוצאים עצים ישנים, פסולת, או עצמות (!) — עלויות הפינוי עולות. כלול תרחיש זה בחוזה',
        is_required: true,
      },
      {
        name: 'יציקת יסודות',
        description: 'יציקת בטון ליסודות לפי תוכנית המהנדס, הנחת ארמטורה',
        priority: 'critical',
        planned_cost: 90000,
        why_important: 'היסודות הם "שורשי" הבית — יסודות פגומים = בית לא בטוח לחלוטין',
        what_if_skip: 'אי אפשר לדלג — זה מבנה הבית',
        pro_tip: 'לפני יציקה: המפקח חייב לאשר את הארמטורה. אחרי יציקה: 28 יום ייבוש לפחות — אל תמהר להמשיך',
        is_required: true,
      },
      {
        name: 'הקמת קירות ועמודים',
        description: 'בניית קירות נושאים, עמודים, גשרים ומדרגות',
        priority: 'critical',
        planned_cost: 130000,
        why_important: 'מבנה הבית — הכל נבנה מעל זה',
        what_if_skip: 'אי אפשר לדלג',
        pro_tip: 'בדוק בכל שלב שהקירות ישרים ובאנכי. קיר עקום = בעיה שקשה מאוד לתקן בשלב הגמר',
        is_required: true,
      },
      {
        name: 'יציקת תקרות',
        description: 'יציקת תקרות בין-קומתיות לפי תוכנית הקונסטרוקציה',
        priority: 'critical',
        planned_cost: 70000,
        why_important: 'תקרה היא גם הרצפה של הקומה הבאה — חייבת להיות יציקה איכותית',
        what_if_skip: 'אי אפשר לדלג',
        pro_tip: 'לפני כל יציקה — המפקח חייב לאשר. אחרי יציקה — בדוק שאין בועות אוויר (honeycombing)',
        is_required: true,
      },
      {
        name: 'גג ואיטום גג',
        description: 'בניית גג, יציקת מפלס גג, והנחת שכבות איטום וחומרי בידוד',
        priority: 'critical',
        planned_cost: 60000,
        why_important: 'הגג מגן על כל הבית. נזילת גג הורסת את כל שלב הגמר — נזק של עשרות אלפים',
        what_if_skip: 'אי אפשר לדלג',
        pro_tip: 'ודא שיש בידוד תרמי בגג (פוליסטירן / פוליאוריתן) — חיסכון של אלפי שקלים בשנה בחשמל. שיפוע מים תקין חובה',
        is_required: true,
      },
      {
        name: 'אישור מהנדס לשלד ושחרור כספי משכנתא',
        description: 'ביקור מהנדס הקונסטרוקציה, אישור השלד, ובקשת שחרור שלב מהבנק',
        priority: 'critical',
        planned_cost: 2000,
        why_important: 'הבנק מחייב אישור מהנדס ומפקח לפני שחרור כל תשלום. בלי זה — הכסף לא מגיע',
        what_if_skip: 'לא מקבלים כסף מהבנק, לא ניתן לשלם לקבלן',
        pro_tip: 'תאם מראש עם הבנק מה הם צריכים לכל שחרור — הכן את המסמכים מבעוד מועד',
        is_required: true,
      },
    ],
  },
  {
    name: 'גמר',
    sort_order: 4,
    planned_cost: 500000,
    tasks: [
      // שלב א׳: תשתיות פנימיות — לפני כל סגירה
      {
        name: 'עבודות אינסטלציה (מים וביוב)',
        description: 'הנחת צנרת מים קרים/חמים, ביוב פנים-בית, בדיקות לחץ',
        priority: 'critical',
        planned_cost: 45000,
        why_important: 'חייב להיות לפני ריצוף! נזילה מתחת לריצוף = הריסה ותיקון של עשרות אלפים',
        what_if_skip: 'לא ניתן לגור בבית. תיקון אחרי ריצוף = סיוט',
        pro_tip: 'לפני ריצוף: בצע בדיקת לחץ (10 בר, 24 שעות). אל תריץ בלי אישור אינסטלטור. תעד צילום של מיקום כל הצנרת',
        is_required: true,
      },
      {
        name: 'עבודות חשמל',
        description: 'הנחת קופסות, צינורות וכבלים, לוח חשמל ראשי ומשני',
        priority: 'critical',
        planned_cost: 50000,
        why_important: 'חשמל לקוי = סכנת שריפה. זה לא משהו שמתפשרים עליו. חייב לפני גבס',
        what_if_skip: 'לא ניתן לחבר לרשת חשמל, סכנה בטיחותית',
        pro_tip: 'תכנן שקעים ב-50% יותר ממה שנראה לך צריך — תמיד צריך יותר. שקעי USB, לוח חשמל חכם, הכנה לרכב חשמלי',
        is_required: true,
      },
      {
        name: 'הנחת צנרת לתקשורת ואינטרנט',
        description: 'הנחת צינורות לכבלי תקשורת, רשת, אנטנה, מצלמות אבטחה',
        priority: 'high',
        planned_cost: 5000,
        why_important: 'לאחר גבס — אי אפשר להוסיף צינורות. עלות בשלב זה: אלפים. עלות אחרי: עשרות אלפים',
        what_if_skip: 'כבלים חשופים על הקירות לנצח, או פתיחת גבס יקרה',
        pro_tip: 'הנח צינור מהמסד לכל חדר. הנח צינור ריק גדול מחוץ לבית — גמישות לעתיד',
        is_required: true,
      },
      // שלב ב׳: בנייה יבשה וחיפויים
      {
        name: 'עבודות גבס ואיטום לחות',
        description: 'קירות גבס, תקרות גבס, הוצאת מדרגות, וגוממות, ואיטום אמבטיות ומרפסות',
        priority: 'critical',
        planned_cost: 40000,
        why_important: 'איטום לחות גרוע = עובש, רטיבות, ובריאות לקויה. חייב לפני ריצוף',
        what_if_skip: 'נזקי רטיבות יעלו פי 5 לתיקון. עובש בקירות מסוכן לבריאות',
        pro_tip: 'שים לב במיוחד לאיטום אמבטיות ומרפסות — שם 80% מהבעיות. השתמש במרחי אלסטי + רשת',
        is_required: true,
      },
      {
        name: 'התקנת אלומיניום, חלונות ודלתות חוץ',
        description: 'התקנת מסגרות, חלונות, דלתות כניסה ויציאה, תריסים',
        priority: 'critical',
        planned_cost: 55000,
        why_important: 'חייב לפני ריצוף! ריצוף מתחת לחלונות חייב להיות מדויק. גם מגן על הבית מאבק ומים',
        what_if_skip: 'ריצוף שגוי מול חלון, אבק בנייה מזיק לריצוף, חדירת מים בגשם',
        pro_tip: 'בחר זכוכית כפולה (דאבל גלאס) — ההשקעה מחזירה את עצמה תוך 3-4 שנים בחיסכון בחשמל',
        is_required: true,
      },
      {
        name: 'ריצוף וחיפויים',
        description: 'הנחת אריחים בריצוף, חיפויי קיר, פרקט, אנטי-סליפ במרפסות',
        priority: 'critical',
        planned_cost: 70000,
        why_important: 'הרצפה היא החוויה הוויזואלית הגדולה ביותר בבית. ביצוע לקוי = בחירה מחדש יקרה',
        what_if_skip: 'לא ניתן לגור בבית',
        pro_tip: 'קנה 10-15% יותר אריחים ממה שצריך — גוון ייפסק ובעתיד קשה למצוא אותו. שמור קופסה מכל דגם',
        is_required: true,
      },
      // שלב ג׳: גמרים ותשתיות לגמר
      {
        name: 'עבודות שיש, מטבח ומדפים',
        description: 'מדידה, ייצור והתקנת שיש, ארונות מטבח ונישות',
        priority: 'high',
        planned_cost: 70000,
        why_important: 'המטבח הוא לב הבית — כדאי להשקיע בתכנון נכון מראש',
        what_if_skip: 'לא ניתן לגור בבית בצורה נוחה',
        pro_tip: 'מדד שיש חייב להגיע לאחר ריצוף — לפני כן הגובה לא מדויק. אל תזמין שיש לפני שהריצוף נגמר',
        is_required: true,
      },
      {
        name: 'ארונות בנויים ודלתות פנים',
        description: 'התקנת ארונות בנויים, דלתות פנים, ידיות ומנגנונים',
        priority: 'high',
        planned_cost: 40000,
        why_important: 'דלתות פנים חייבות להיות לפני צביעה סופית — למנוע נזק מצבע',
        what_if_skip: 'בית ללא ארונות ודלתות — לא ניתן לגור',
        pro_tip: 'בחר ידיות וברזים בסגנון אחד עקבי — זה הפרט הקטן שמאחד את כל הבית',
        is_required: true,
      },
      {
        name: 'צביעה (פנים וחוץ)',
        description: 'צביעת כל הקירות, תקרות, פנים וחזית חיצונית',
        priority: 'high',
        planned_cost: 35000,
        why_important: 'הצבע הוא "הבגד" של הבית — האסתטיקה הסופית. גם מגן על הקירות',
        what_if_skip: 'בית לא גמור, קירות חשופים מתלכלכים מהר',
        pro_tip: 'צייר מקצועי הוא הבדל ניראותי עצום. חסכון בצייר = בית שנראה זול. הכנת קירות (שפכלה) חשובה יותר מהצבע עצמו',
        is_required: true,
      },
      {
        name: 'תאורה, שקעים וגופי אינסטלציה',
        description: 'חיבור גופי תאורה, שקעים, ברזים, אמבטיות, מקלחות ואביזרי חדרי שירותים',
        priority: 'high',
        planned_cost: 30000,
        why_important: 'זה מה שהופך את הבית לפונקציונלי — תאורה, מים וחשמל בכל מקום',
        what_if_skip: 'בית חשוך ולא פונקציונלי',
        pro_tip: 'שלב התאורה בעיצוב פנים. תאורה נכונה מגדילה את תחושת המרחב משמעותית',
        is_required: true,
      },
      {
        name: 'גינון ופיתוח חצר',
        description: 'פיתוח חצר, הנחת אבן/בטון לחנייה ושבילים, גינון, גדר',
        priority: 'normal',
        planned_cost: 40000,
        why_important: 'הרושם הראשוני של הבית. גם שמירה על יסודות מפני שיטפונות',
        what_if_skip: 'בוץ ואבק ליד הבית, בעיות ניקוז',
        pro_tip: 'גינון כולל מערכת השקיה — השקעה שמשתלמת מיד. בחר צמחים דלי מים לחיסכון',
        is_required: false,
      },
      // שלב ד׳: אישורים סופיים
      {
        name: 'קבלת טופס 4 (אישור אכלוס)',
        description: 'הגשת בקשה לאישור אכלוס, ביקור מפקח רשות, קבלת טופס 4',
        priority: 'critical',
        planned_cost: 3000,
        why_important: 'בלי טופס 4 לא ניתן לאכלס את הבית — חוקית. לא ניתן לחבר חשמל, מים, ארנונה',
        what_if_skip: 'גרים "באיסור", לא ניתן לקבל משכנתא סופית, בעיות עם ביטוח',
        pro_tip: 'אל תקבל מפתח מהקבלן לפני שיש טופס 4. הכן רשימת ליקויים (בדק בית) לפני שחותמים על קבלת הדירה',
        is_required: true,
      },
      {
        name: 'בדק בית (רשימת ליקויים)',
        description: 'סיור מקצועי עם חברת בדק בית לאיתור ליקויי בנייה לפני אכלוס',
        priority: 'critical',
        planned_cost: 2500,
        why_important: 'קבלן מחויב לתקן ליקויים שנמצאים לפני אכלוס. אחרי אכלוס — קשה יותר להוכיח',
        what_if_skip: 'ליקויים שיתגלו אחר כך יהיו על חשבונך ובאחריותך',
        pro_tip: 'בדק בית מקצועי עולה כמה אלפים ומוצא בממוצע ליקויים בעשרות אלפים. ה-ROI ברור',
        is_required: true,
      },
    ],
  },
]

export function getStageColor(stageName: string): string {
  const colors: Record<string, string> = {
    'קרקע': 'amber',
    'היתר בנייה': 'blue',
    'שלד': 'orange',
    'גמר': 'emerald',
  }
  return colors[stageName] ?? 'gray'
}

export function getStageIcon(stageName: string): string {
  const icons: Record<string, string> = {
    'קרקע': 'landscape',
    'היתר בנייה': 'description',
    'שלד': 'construction',
    'גמר': 'home',
  }
  return icons[stageName] ?? 'check_circle'
}

export function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    critical: 'קריטי',
    high: 'גבוה',
    normal: 'רגיל',
    low: 'נמוך',
  }
  return labels[priority]
}

export function getPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    critical: 'red',
    high: 'orange',
    normal: 'blue',
    low: 'gray',
  }
  return colors[priority]
}

// ─── Personalized Stages ────────────────────────────────────────────────────

export type LocationType = 'city' | 'moshav' | 'kibbutz' | 'other'
export type OwnershipType = 'private' | 'rma'
export type BuildType = 'self' | 'turnkey'

export function getPersonalizedStages(
  locationType: LocationType | null,
  ownershipType: OwnershipType | null,
  buildType: BuildType | null
): DefaultStage[] {
  // deep copy
  const stages: DefaultStage[] = JSON.parse(JSON.stringify(DEFAULT_STAGES))

  const isRmaOrMoshavOrKibbutz =
    ownershipType === 'rma' ||
    locationType === 'moshav' ||
    locationType === 'kibbutz'

  if (isRmaOrMoshavOrKibbutz) {
    // ── קרקע stage changes ──
    const karakaStage = stages.find(s => s.name === 'קרקע')
    if (karakaStage) {
      // Find and update the רמ"י task
      const rmaTask = karakaStage.tasks.find(t => t.name === 'הבנת תשלומי רמ"י (אם רלוונטי)')
      if (rmaTask) {
        rmaTask.is_required = true
        rmaTask.name = 'תשלומי רמ"י — חובה לבדוק לפני הכל'
      }

      // Add ועד task at the beginning (sort_order 0, shift others)
      const vaadTask: DefaultTask = {
        name: 'בדיקת זכויות בנחלה / וועד מושב',
        description: 'בדיקת מה מותר לבנות בנחלה, קבלת אישור עקרוני מוועד המושב/קיבוץ לפני כל השקעה',
        priority: 'critical',
        planned_cost: 0,
        why_important: 'וועד מושב/קיבוץ יכול לחסום בנייה — חייבים לקבל הסכמה לפני שמוציאים כסף',
        what_if_skip: 'קנייה/בנייה ללא אישור ועד = חסימה מלאה של הפרויקט',
        pro_tip: 'פגוש את מזכיר המושב/קיבוץ בפגישה אחת לפני הכל. שאל מה תנאי האישור ומה עלויות 33%',
        is_required: true,
      }
      karakaStage.tasks.unshift(vaadTask)
    }

    // ── היתר בנייה stage changes ──
    const hiterStage = stages.find(s => s.name === 'היתר בנייה')
    if (hiterStage) {
      const mehnadezIdx = hiterStage.tasks.findIndex(t => t.name === 'בחירת מהנדס קונסטרוקציה')
      const rmaFeeTask: DefaultTask = {
        name: 'תשלום דמי היתר לרמ"י',
        description: 'פנייה לרשות מקרקעי ישראל, חישוב דמי היתר ותשלומם לפני קבלת היתר',
        priority: 'critical',
        planned_cost: 50000,
        why_important: 'רמ"י לא ייתן אישור להיתר ללא תשלום דמי ההיתר. זה יכול לעכב חודשים',
        what_if_skip: 'עיכוב של חודשים בהיתר + ריבית פיגורים על הסכום',
        pro_tip: 'פנה לרמ"י מוקדם ככל האפשר — תהליך הבירוקרטיה לוקח 2-4 חודשים',
        is_required: true,
      }
      if (mehnadezIdx !== -1) {
        hiterStage.tasks.splice(mehnadezIdx + 1, 0, rmaFeeTask)
      } else {
        hiterStage.tasks.push(rmaFeeTask)
      }
    }
  }

  // ── מושב-specific: תשלום 33% ──
  if (locationType === 'moshav') {
    const karakaStage = stages.find(s => s.name === 'קרקע')
    if (karakaStage) {
      const vaadIdx = karakaStage.tasks.findIndex(t => t.name === 'בדיקת זכויות בנחלה / וועד מושב')
      const thirtyThreeTask: DefaultTask = {
        name: 'בדיקת תשלום 33% ליחידת דיור נוספת',
        description: 'בדיקה האם נדרש תשלום 33% לרמ"י על בניית יחידת הדיור',
        priority: 'high',
        planned_cost: 0,
        why_important: 'בנחלה חקלאית — יחידת דיור שנייה מחייבת תשלום 33% משוויה לרמ"י. יכול להגיע ל-200K+',
        what_if_skip: 'גילוי מאוחר של תשלום גדול שלא תוכנן בתקציב',
        pro_tip: 'שאל את עורך הדין: מה היחידה הראשונה? מה הנוספת? מה העלות המדויקת?',
        is_required: false,
      }
      if (vaadIdx !== -1) {
        karakaStage.tasks.splice(vaadIdx + 1, 0, thirtyThreeTask)
      } else {
        karakaStage.tasks.push(thirtyThreeTask)
      }
    }
  }

  // ── turnkey: rename קבלן שלד ──
  if (buildType === 'turnkey') {
    const shaledStage = stages.find(s => s.name === 'שלד')
    if (shaledStage) {
      const kablanTask = shaledStage.tasks.find(t => t.name === 'בחירת קבלן שלד וחתימת חוזה')
      if (kablanTask) {
        kablanTask.name = 'בחירת קבלן מפתח וחתימת חוזה'
        kablanTask.description = 'מציאת קבלן מפתח שיישא באחריות מלאה על כל שלבי הבנייה — שלד, גמר ומסירה'
      }
    }
  }

  return stages
}
