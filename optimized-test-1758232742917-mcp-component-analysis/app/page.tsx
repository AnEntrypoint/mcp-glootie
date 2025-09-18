
import { TaskManager } from '@/components/task-manager'
export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Task Manager</h1>
          <p className="text-muted-foreground mt-4">
            A modern task management application built with Next.js and shadcn/ui
          </p>
        </div>
        <TaskManager />
      </div>
    </main>
  )
}
