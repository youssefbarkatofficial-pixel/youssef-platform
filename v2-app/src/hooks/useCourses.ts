import { useCallback, useEffect, useState } from 'react';
import { getCourse, invalidateCoursesCache, listCourses, subscribeCourse } from '../services/courses';
import type { Course } from '../services/courses';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setCourses(await listCourses());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      invalidateCoursesCache();
      void load();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [load]);

  return { courses, loading, error, reload: load };
}

export function useCourse(courseId: string | undefined, options?: { live?: boolean }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const live = options?.live === true;

  const load = useCallback(async () => {
    if (!courseId) {
      setCourse(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      setCourse(await getCourse(courseId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();

    if (!courseId) return;

    let unsubCourse: (() => void) | null = null;
    if (live) {
      unsubCourse = subscribeCourse(courseId, (nextCourse) => {
        setCourse(nextCourse);
        setError(false);
        setLoading(false);
      });
    }

    const handleOnline = () => {
      void load();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      unsubCourse?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [courseId, live, load]);

  return { course, loading, error, reload: load };
}
