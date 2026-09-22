import { z } from 'zod'

/** Auth & Users */
const authSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    current_password: z.string(),
    password: z.string(),
    password_confirmation: z.string(),
    token: z.string()
})

type Auth = z.infer<typeof authSchema>
export type UserLoginForm = Pick<Auth, 'email' | 'password'>
export type UserRegistrationForm = Pick<Auth, 'name' | 'email' | 'password' | 'password_confirmation'>
export type RequestConfirmationCodeForm = Pick<Auth, 'email'>
export type ForgotPasswordForm = Pick<Auth, 'email'>
export type NewPasswordForm = Pick<Auth, 'password' | 'password_confirmation'>
export type UpdateCurrentUserPasswordForm = Pick<Auth, 'current_password' | 'password' | 'password_confirmation'>
export type ConfirmToken = Pick<Auth, 'token'>
export type CheckPasswordForm = Pick<Auth, 'password'>

/** Users */
export const schedulePrefsSchema = z.object({
    dayStartHour: z.number(),
    dayEndHour: z.number(),
    showWeekends: z.boolean()
})

export const userSchema = authSchema.pick({
    name: true,
    email: true
}).extend({
    _id: z.string(),
    role: z.enum(['manager', 'member']).optional(),
    timezone: z.string().optional(),
    schedulePrefs: schedulePrefsSchema.optional()
})
export type User = z.infer<typeof userSchema>
export type UserProfileForm = Pick<User, 'name' | 'email'>
export type SchedulePrefs = z.infer<typeof schedulePrefsSchema>

/** Notes */
const noteSchema = z.object({
    _id: z.string(),
    content: z.string(),
    createdBy: userSchema,
    task: z.string(),
    createdAt: z.string()
})
export type Note = z.infer<typeof noteSchema>
export type NoteFormData = Pick<Note, 'content'>

/** Marcas / áreas */
export const brandSchema = z.object({
    _id: z.string(),
    name: z.string(),
    color: z.string()
})
export type Brand = z.infer<typeof brandSchema>

/** Tasks */
export const taskStatusSchema = z.enum(["pending", "inProgress", "done"])
export type TaskStatus = z.infer<typeof taskStatusSchema>

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"])
export type TaskPriority = z.infer<typeof taskPrioritySchema>

const userRefSchema = z.union([userSchema, z.string()]).nullable().optional()
const projectRefSchema = z.union([
    z.object({
        _id: z.string(),
        projectName: z.string(),
        team: z.array(z.object({ _id: z.string(), name: z.string() })).optional()
    }),
    z.string()
]).nullable().optional()
const brandRefSchema = z.union([brandSchema, z.string()]).nullable().optional()

export const taskColorTagSchema = z.enum(['orange', 'green', 'fuchsia', 'celeste']).nullable().default(null)
export type TaskColorTag = z.infer<typeof taskColorTagSchema>

export const taskSchema = z.object({
    _id: z.string(),
    name: z.string(),
    description: z.string().default(''),
    project: projectRefSchema,
    brand: brandRefSchema,
    colorTag: taskColorTagSchema,
    status: taskStatusSchema,
    onHold: z.object({
        active: z.boolean(),
        reason: z.string(),
        waitingOn: z.string(),
        followUpDate: z.string().nullable()
    }).optional(),
    review: z.object({
        needed: z.boolean(),
        approver: userRefSchema,
        requestedAt: z.string().nullable()
    }).optional(),
    assignee: userRefSchema,
    collaborators: z.array(z.union([userSchema, z.string()])).default([]),
    definitionOfDone: z.string().default(''),
    priority: taskPrioritySchema.default('medium'),
    estimatedMinutes: z.number().nullable().default(null),
    dueDate: z.string().nullable().default(null),
    /** El día en que se piensa hacer, sin hora. Es lo que arma "Hoy": no es
     *  un bloque de calendario ni una fecha límite. */
    plannedDate: z.string().nullable().default(null),
    /** Posición manual dentro de su lista (Pendientes, un día, Por validar):
     *  a igual valor, se respeta el orden que ya traía. */
    order: z.number().default(0),
    checklist: z.array(z.object({
        _id: z.string().optional(),
        text: z.string(),
        done: z.boolean()
    })).default([]),
    dependencies: z.array(z.any()).default([]),
    parentTask: z.string().nullable().optional(),
    isPrivate: z.boolean().default(false),
    frequency: z.enum([
        'none', 'daily', 'everyOtherDay', 'weekly', 'biweekly', 'monthly', 'onDemand'
    ]).default('none'),
    lastCompletedAt: z.string().nullable().optional(),
    doneForPeriod: z.boolean().optional(),
    statusHistory: z.array(z.object({
        _id: z.string().optional(),
        from: taskStatusSchema.nullable(),
        to: taskStatusSchema,
        changedBy: userRefSchema,
        changedAt: z.string(),
        note: z.string()
    })).default([]),
    notes: z.array(z.any()).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
})

export const taskProjectSchema = taskSchema.pick({
    _id: true,
    name: true,
    description: true,
    status: true,
    priority: true,
    assignee: true,
    dueDate: true,
    estimatedMinutes: true,
    onHold: true,
    review: true
})

export type Task = z.infer<typeof taskSchema>
export type TaskFormData = Pick<Task, 'name' | 'description'>
export type TaskProject = z.infer<typeof taskProjectSchema>

/** Creación rápida: basta el título. El resto de campos es progresivo. */
export type QuickTaskFormData = {
    name: string
    assignee?: string
    project?: string
    priority?: TaskPriority
    estimatedMinutes?: number | null
    dueDate?: string | null
    plannedDate?: string | null
    definitionOfDone?: string
}

/** Bloques de calendario */
/** Persona tal como viene poblada dentro de un bloque. */
const blockPersonSchema = z.union([
    z.object({ _id: z.string(), name: z.string(), email: z.string().optional() }),
    z.string()
])

export const timeBlockSchema = z.object({
    _id: z.string(),
    task: z.union([taskSchema.partial().extend({ _id: z.string(), name: z.string() }), z.string()]),
    /** Calendario al que pertenece el bloque. */
    user: blockPersonSchema,
    start: z.string(),
    end: z.string(),
    note: z.string().default(''),
    createdBy: z.string().optional(),
    /** Personas etiquetadas: lo ven en su calendario. */
    guests: z.array(blockPersonSchema).default([])
})

/** Aviso de que alguien etiquetado ya tenía algo a esa hora. */
export const guestConflictSchema = z.object({
    user: z.object({ _id: z.string(), name: z.string() }),
    count: z.number()
})
export type GuestConflict = z.infer<typeof guestConflictSchema>
export type TimeBlock = z.infer<typeof timeBlockSchema>

export const weekScheduleSchema = z.object({
    user: userSchema.pick({ _id: true, name: true, email: true }),
    timezone: z.string(),
    schedulePrefs: schedulePrefsSchema,
    weekStart: z.string(),
    weekEnd: z.string(),
    blocks: z.array(timeBlockSchema)
})
export type WeekSchedule = z.infer<typeof weekScheduleSchema>

/** Bloques de un rango cualquiera: lo que pintan las vistas de mes y de
 *  trimestre, que no necesitan las preferencias de franja. */
export const rangeScheduleSchema = z.object({
    user: userSchema.pick({ _id: true, name: true, email: true }),
    timezone: z.string(),
    from: z.string(),
    to: z.string(),
    blocks: z.array(timeBlockSchema)
})
export type RangeSchedule = z.infer<typeof rangeScheduleSchema>

export const dayScheduleSchema = z.object({
    user: userSchema.pick({ _id: true, name: true, email: true }),
    timezone: z.string(),
    dayStart: z.string(),
    dayEnd: z.string(),
    blocks: z.array(timeBlockSchema),
    dueToday: z.array(taskSchema),
    overdue: z.array(taskSchema),
    scheduledMinutes: z.number(),
    windowMinutes: z.number(),
    unscheduledWindowMinutes: z.number()
})
export type DaySchedule = z.infer<typeof dayScheduleSchema>

export const unscheduledRowSchema = z.object({
    task: taskSchema,
    scheduledMinutes: z.number(),
    scheduledDays: z.number().default(0),
    expectedPerWeek: z.number().default(1),
    estimatedMinutes: z.number().nullable(),
    remainingMinutes: z.number().nullable(),
    doneForPeriod: z.boolean().default(false),
    fullyScheduled: z.boolean()
})
export const unscheduledListSchema = z.array(unscheduledRowSchema)
export type UnscheduledRow = z.infer<typeof unscheduledRowSchema>

/** Panel del equipo: una columna por persona. */
export const teamPanelSchema = z.object({
    user: userSchema.pick({ _id: true, name: true, email: true }).extend({
        role: z.enum(['manager', 'member']).optional()
    }),
    tasks: z.array(taskSchema),
    scheduledToday: z.number()
})
export const teamBoardSchema = z.object({
    date: z.string(),
    panels: z.array(teamPanelSchema)
})
export type TeamPanel = z.infer<typeof teamPanelSchema>
export type TeamBoard = z.infer<typeof teamBoardSchema>

/** Projects */
export const projectSchema = z.object({
    _id: z.string(),
    projectName: z.string(),
    /** Opcionales: un proyecto nace con solo su nombre. */
    clientName: z.string().default(''),
    description: z.string().default(''),
    brand: z.union([brandSchema, z.string()]).nullable().optional(),
    manager: z.string(userSchema.pick({_id: true})),
    tasks: z.array(taskProjectSchema),
    team: z.array(z.string(userSchema.pick({_id: true}))),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
})
export const projectStatsSchema = z.object({
    pending: z.number(),
    inProgress: z.number(),
    toValidate: z.number(),
    done: z.number(),
    total: z.number()
})
export type ProjectStats = z.infer<typeof projectStatsSchema>

export const dashboardProjectSchema = z.array(
    projectSchema.pick({
        _id: true,
        projectName: true,
        clientName: true,
        description: true,
        manager: true
    }).extend({
        stats: projectStatsSchema
    })
)
export type DashboardProject = z.infer<typeof dashboardProjectSchema>[number]
export const editProjectSchema = projectSchema.pick({
    projectName: true,
    clientName: true,
    description: true,
    brand: true,
})
export type Project = z.infer<typeof projectSchema>
export type ProjectFormData = {
    projectName: string
    clientName?: string
    description?: string
    brand?: string
}

/** Team */
const teamMemberSchema = userSchema.pick({
    name: true,
    email: true,
    _id: true
})
export const teamMembersSchema = z.array(teamMemberSchema)
export type TeamMember = z.infer<typeof teamMemberSchema>
export type TeamMemberForm = Pick<TeamMember, 'email'>

/** Notas del equipo: bloc de apuntes en Markdown. */
export const memoPrioritySchema = z.enum(['none', 'low', 'medium', 'high'])
export type MemoPriority = z.infer<typeof memoPrioritySchema>

export const memoSchema = z.object({
    _id: z.string(),
    title: z.string(),
    content: z.string().default(''),
    owner: z.union([userSchema, z.string()]),
    visibility: z.enum(['private', 'team']),
    priority: memoPrioritySchema.default('none'),
    date: z.string().nullable().default(null),
    archived: z.boolean().default(false),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
})
export const memoListSchema = z.array(memoSchema)
export type Memo = z.infer<typeof memoSchema>

/** Informe: tiempo de "En proceso" a "Listo", en horario laboral. */
export const taskDurationRowSchema = z.object({
    taskId: z.string(),
    taskName: z.string(),
    assigneeName: z.string(),
    startedAt: z.string().nullable(),
    finishedAt: z.string(),
    businessMinutes: z.number().nullable()
})
export const taskDurationReportSchema = z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
    finishedCount: z.number(),
    averageMinutes: z.number().nullable(),
    rows: z.array(taskDurationRowSchema)
})
export type TaskDurationRow = z.infer<typeof taskDurationRowSchema>
export type TaskDurationReport = z.infer<typeof taskDurationReportSchema>

/** Un pendiente ya cerrado, para la vista "Finalizados": por la fecha real
 *  del último paso a Listo, no por cuándo se tocó por última vez. */
export const finishedRowSchema = z.object({
    taskId: z.string(),
    taskName: z.string(),
    assigneeId: z.string().nullable(),
    assigneeName: z.string(),
    finishedAt: z.string()
})
export const finishedReportSchema = z.object({
    rows: z.array(finishedRowSchema)
})
export type FinishedRow = z.infer<typeof finishedRowSchema>
