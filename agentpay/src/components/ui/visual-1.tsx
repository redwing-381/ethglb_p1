import * as React from "react"

interface Visual1Props {
  mainColor?: string
  secondaryColor?: string
  gridColor?: string
  overlayTitle?: string
  overlayDescription?: string
  badges?: { label: string; color: string }[]
}

export function Visual1({
  mainColor = "#8b5cf6",
  secondaryColor = "#fbbf24",
  gridColor = "#80808015",
  overlayTitle,
  overlayDescription,
  badges,
}: Visual1Props) {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden rounded-t-lg">
      <Layer1 color={mainColor} secondaryColor={secondaryColor} />
      <Layer2 color={mainColor} />
      <Layer3 badges={badges} mainColor={mainColor} secondaryColor={secondaryColor} />
      <Layer4 title={overlayTitle} description={overlayDescription} />
      <EllipseGradient color={mainColor} />
      <GridLayer color={gridColor} />
    </div>
  )
}

const GridLayer = ({ color }: { color: string }) => (
  <div
    style={{ "--grid-color": color } as React.CSSProperties}
    className="pointer-events-none absolute inset-0 z-[4] h-full w-full bg-transparent bg-[linear-gradient(to_right,var(--grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-color)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)] bg-[size:20px_20px] bg-center opacity-70"
  />
)

const EllipseGradient = ({ color }: { color: string }) => (
  <div className="absolute inset-0 z-[5] flex h-full w-full items-center justify-center">
    <svg width="356" height="196" viewBox="0 0 356 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="356" height="180" fill="url(#paint-v1)" />
      <defs>
        <radialGradient id="paint-v1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(178 98) rotate(90) scale(98 178)">
          <stop stopColor={color} stopOpacity="0.25" />
          <stop offset="0.34" stopColor={color} stopOpacity="0.15" />
          <stop offset="1" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  </div>
)

const Layer1 = ({ color, secondaryColor }: { color: string; secondaryColor?: string }) => (
  <div className="ease-[cubic-bezier(0.6,0.6,0,1)] absolute top-0 left-0 z-[6] transform transition-transform duration-500 group-hover/animated-card:translate-x-[-50%]">
    <svg className="w-[712px]" viewBox="0 0 712 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 178C8 176.343 9.34315 175 11 175H25C26.6569 175 28 176.343 28 178V196H8V178Z" fill={color} />
      <path d="M32 168C32 166.343 33.3431 165 35 165H49C50.6569 165 52 166.343 52 168V196H32V168Z" fill={secondaryColor} />
      <path d="M67 173C67 171.343 68.3431 170 70 170H84C85.6569 170 87 171.343 87 173V196H67V173Z" fill={color} />
      <path d="M91 153C91 151.343 92.3431 150 94 150H108C109.657 150 111 151.343 111 153V196H91V153Z" fill={secondaryColor} />
      <path d="M126 142C126 140.343 127.343 139 129 139H143C144.657 139 146 140.343 146 142V196H126V142Z" fill={color} />
      <path d="M150 158C150 156.343 151.343 155 153 155H167C168.657 155 170 156.343 170 158V196H150V158Z" fill={secondaryColor} />
      <path d="M187 133C187 131.343 188.343 130 190 130H204C205.657 130 207 131.343 207 133V196H187V133Z" fill={color} />
      <path d="M211 161C211 159.343 212.343 158 214 158H228C229.657 158 231 159.343 231 161V196H211V161Z" fill={secondaryColor} />
      <path d="M248 150C248 148.343 249.343 147 251 147H265C266.657 147 268 148.343 268 150V196H248V150Z" fill={color} />
      <path d="M272 130C272 128.343 273.343 127 275 127H289C290.657 127 292 128.343 292 130V196H272V130Z" fill={secondaryColor} />
      <path d="M307 133C307 131.343 308.343 130 310 130H324C325.657 130 327 131.343 327 133V196H307V133Z" fill={color} />
      <path d="M331 155C331 153.343 332.343 152 334 152H348C349.657 152 351 153.343 351 155V196H331V155Z" fill={secondaryColor} />
      <path d="M363 161C363 159.343 364.343 158 366 158H380C381.657 158 383 159.343 383 161V196H363V161Z" fill={color} />
      <path d="M387 144C387 142.343 388.343 141 390 141H404C405.657 141 407 142.343 407 144V196H387V144Z" fill={secondaryColor} />
      <path d="M423 126C423 124.343 424.343 123 426 123H440C441.657 123 443 124.343 443 126V196H423V126Z" fill={color} />
      <path d="M447 142C447 140.343 448.343 139 450 139H464C465.657 139 467 140.343 467 142V196H447V142Z" fill={secondaryColor} />
      <path d="M483 125C483 124.1 484.343 123 486 123H500C501.657 123 503 124.1 503 125V196H483V125Z" fill={color} />
      <path d="M507 137C507 136.1 508.343 135 510 135H524C525.657 135 527 136.1 527 137V196H507V137Z" fill={secondaryColor} />
      <path d="M543 108C543 106.4 544.343 105 546 105H560C561.657 105 563 106.4 563 108V196H543V108Z" fill={color} />
      <path d="M567 116C567 115.1 568.343 114 570 114H584C585.657 114 587 115.1 587 116V196H567V116Z" fill={secondaryColor} />
      <path d="M603 80C603 78.3 604.343 77 606 77H620C621.657 77 623 78.3 623 80V196H603V80Z" fill={color} />
      <path d="M627 92C627 90.3 628.343 89 630 89H644C645.657 89 647 90.3 647 92V196H627V92Z" fill={secondaryColor} />
      <path d="M661 67C661 65.2 662.343 64 664 64H678C679.657 64 681 65.2 681 67V196H661V67Z" fill={color} />
      <path d="M685 56C685 54.2 686.343 53 688 53H702C703.657 53 705 54.2 705 56V196H685V56Z" fill={secondaryColor} />
    </svg>
  </div>
)

const Layer2 = ({ color }: { color: string }) => (
  <div className="absolute top-0 left-[-1px] h-full w-[356px]">
    <svg className="h-full w-[356px]" viewBox="0 0 356 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip-v1)">
        <path d="M1 131.5L33.5 125.5L64 102.5L93.5 118.5L124.5 90L154 100.5L183.5 76L207.5 92L244.5 51L274.5 60.5L307.5 46L334.5 28.5L356.5 1" stroke={color} />
        <path d="M33.5 125.5L1 131.5V197H356.5V1L335 28.5L306.5 46L274.5 60.5L244.5 51L207.5 92L183.5 76L154 100.5L124.5 90L93.5 118.5L64 102.5L33.5 125.5Z" fill={color} fillOpacity="0.3" />
      </g>
      <defs><clipPath id="clip-v1"><rect width="356" height="180" fill="white" /></clipPath></defs>
    </svg>
    <div className="ease-[cubic-bezier(0.6,0.6,0,1)] absolute inset-0 z-[3] transform bg-gradient-to-r from-transparent from-0% to-white to-15% transition-transform duration-500 group-hover/animated-card:translate-x-full dark:to-black" />
  </div>
)

const Layer3 = ({ badges, mainColor, secondaryColor }: { badges?: { label: string; color: string }[]; mainColor: string; secondaryColor?: string }) => {
  const items = badges || [
    { label: "Pro", color: mainColor },
    { label: "Con", color: secondaryColor || mainColor },
  ]
  return (
    <div className="absolute top-4 right-4 z-[8] flex items-center gap-1">
      {items.map((b, i) => (
        <div key={i} className="flex shrink-0 items-center rounded-full border border-border bg-card/25 px-1.5 py-0.5 backdrop-blur-sm transition-opacity duration-300 ease-in-out group-hover/animated-card:opacity-0">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.color }} />
          <span className="ml-1 text-[10px] text-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

const Layer4 = ({ title, description }: { title?: string; description?: string }) => (
  <div className="group relative h-full w-[356px]">
    <div className="ease-[cubic-bezier(0.6,0.6,0,1)] absolute inset-0 z-[7] flex max-w-[356px] -translate-y-full items-start justify-start bg-transparent p-4 transition-transform duration-500 group-hover/animated-card:translate-y-0">
      <div className="ease-[cubic-bezier(0.6,0.6,0,1)] rounded-md border border-border bg-card/25 p-1.5 opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover/animated-card:opacity-100">
        <p className="mb-1 text-xs font-semibold text-foreground">{title || "Data Visualization"}</p>
        <p className="text-xs text-muted-foreground">{description || "Displaying interesting stats."}</p>
      </div>
    </div>
  </div>
)
