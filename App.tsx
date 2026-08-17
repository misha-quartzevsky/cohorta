import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from '@shadcn/ui';

// --- Типы данных (можно оставить как есть, React поймет) ---
interface Course {
  id: string;
  name: string;
  // добавляй другие поля, если они есть
}

interface Lecture {
  id: string;
  title: string;
  content: string;
  course: string;   // ID ссылки на курс (pole в PocketBase)
  createdAt: string; // ISO дата строки
}

// --- Основной компонент ---
function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [newLectureTitle, setNewLectureTitle] = useState('');
  const [newLectureContent, setNewLectureContent] = useState('');

  // 1. Функция загрузки всех курсов из PocketBase
  const fetchCourses = async () => {
    try {
      // PocketBase REST API: /api/collections/<collectionId>/records
      const res = await fetch('http://localhost:3088/api/collections/courses/records');
      const data = await res.json();
      setCourses(data.items || []);
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err);
    }
  };

  // 2. Функция загрузки лекций для выбранного курса
  //    Фильтрует по course_id и сортирует по createdAt (новые первыми)
  const fetchLectures = async (courseId: string) => {
    try {
      const res = await fetch(
        `http://localhost:3088/api/collections/lectures/records?filter[course][equals]=${courseId}&sort=-createdAt`
      );
      const data = await res.json();
      const items = data.items || [];
      const sorted = items.sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setLectures(sorted);
    } catch (err) {
      console.error('Ошибка загрузки лекций:', err);
    }
  };

  // 3. Effect: при выборе курса загружаем его лекции
  useEffect(() => {
    if (selectedCourseId) {
      fetchLectures(selectedCourseId);
    } else {
      setLectures([]);
    }
  }, [selectedCourseId]);

  // 4. Обрачение создания новой лекции
  const handleCreateLecture = async () => {
    if (!newLectureTitle.trim() || !selectedCourseId) return;
    try {
      await fetch('http://localhost:3088/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newLectureTitle,
          content: newLectureContent || '',
          course: selectedCourseId, // ссылка на коллекцию courses
        }),
      });
      // После успешного добавления обновляем список лекций
      fetchLectures(selectedCourseId);
      setNewLectureTitle('');
      setNewLectureContent('');
    } catch (err) {
      console.error('Ошибка сохранения лекции:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Шапка приложения */}
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">Cohorta</h1>
        <p className="text-sm opacity-90">SaaS для студентов — запись лекций</p>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        {/* Блок выбора курса (предмета) */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-medium">Выберите курс (предмет)</h2>
          </CardHeader>
          <Select onValueChange={setSelectedCourseId} defaultValue="">
            <SelectTrigger>
              <SelectValue placeholder="Выберите курс..." />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Блок списка лекций */}
        {selectedCourseId && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium">
                Лекции ({lectures.length}) — отсортировано по дате
              </h2>
            </CardHeader>
            <CardContent>
              {lectures.length === 0 ? (
                <p className="text-muted-foreground">Здесь пока нет лекций. Добавьте первую!</p>
              ) : (
                <ul className="space-y-2 pt-2">
                  {lectures.map((lec) => (
                    <li key={lec.id} className="p-2 bg-gray-50 rounded">
                      <h3 className="font-medium text-sm">{lec.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(lec.createdAt).toLocaleDateString('ru-RU', {
                          year: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Форма добавления лекции (видна только если выбран курс) */}
        {selectedCourseId && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium">Добавить новую лекцию</h2>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Название лекции (например, «Введение в философию»)"
                value={newLectureTitle}
                onChange={(e) => setNewLectureTitle(e.target.value)}
                className="w-full mb-2"
              />
              <Input
                placeholder="Содержание (текст лекции)"
                value={newLectureContent}
                onChange={(e) => setNewLectureContent(e.target.value)}
                className="w-full mb-2"
                rows={4}
              />
              <Button onClick={handleCreateLecture} variant="primary" className="w-full">
                Сохранить лекцию
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default App;
