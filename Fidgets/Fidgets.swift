//
//  Fidgets.swift
//  Fidgets - a single-file SwiftUI app of 120 little fidgets.
//
//  Targets iOS 17+. Uses Liquid Glass (.glassEffect) on iOS 26+ and falls back
//  to .regularMaterial on earlier versions. To enable alternate app icons, add
//  the icon image sets to the asset catalog and list them under
//  CFBundleIcons -> CFBundleAlternateIcons in Info.plist with the names used
//  below (AppIcon-Classic, AppIcon-Mint, AppIcon-Coral, AppIcon-Indigo,
//  AppIcon-Slate, AppIcon-Sunset).
//

import SwiftUI
import LocalAuthentication
import PhotosUI

// MARK: - App entry

@main
struct FidgetsApp: App {
    @StateObject private var store = FidgetStore()
    @StateObject private var theme = ThemeStore()
    @StateObject private var lock  = LockStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(theme)
                .environmentObject(lock)
                .preferredColorScheme(theme.appearance.colorScheme)
                .tint(theme.wireColor)
        }
    }
}

// MARK: - Root container handles lock screen

struct RootView: View {
    @EnvironmentObject var lock: LockStore
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            HomeView()
                .blur(radius: lock.isUnlocked ? 0 : 24)
                .allowsHitTesting(lock.isUnlocked)

            if !lock.isUnlocked {
                LockScreen()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: lock.isUnlocked)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background && lock.enabled {
                lock.isUnlocked = false
            }
        }
        .onAppear {
            if !lock.enabled { lock.isUnlocked = true }
        }
    }
}

// MARK: - Appearance / theme

enum Appearance: String, CaseIterable, Codable {
    case system, light, dark
    var label: String {
        switch self {
        case .system: return "System"
        case .light:  return "Light"
        case .dark:   return "Dark"
        }
    }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light:  return .light
        case .dark:   return .dark
        }
    }
}

enum BackgroundStyle: String, CaseIterable, Codable {
    case gradient, mesh, solid, image
    var label: String {
        switch self {
        case .gradient: return "Gradient"
        case .mesh:     return "Mesh"
        case .solid:    return "Solid"
        case .image:    return "Image"
        }
    }
}

final class ThemeStore: ObservableObject {
    @AppStorage("theme.appearance") private var appearanceRaw: String = Appearance.system.rawValue
    @AppStorage("theme.bgStyle")    private var bgStyleRaw:    String = BackgroundStyle.gradient.rawValue
    @AppStorage("theme.wireHue")    var wireHue: Double = 0.58
    @AppStorage("theme.bgHueA")     var bgHueA:  Double = 0.66
    @AppStorage("theme.bgHueB")     var bgHueB:  Double = 0.82
    @AppStorage("theme.bgImage")    var bgImageData: Data = Data()

    var appearance: Appearance {
        get { Appearance(rawValue: appearanceRaw) ?? .system }
        set { appearanceRaw = newValue.rawValue; objectWillChange.send() }
    }
    var bgStyle: BackgroundStyle {
        get { BackgroundStyle(rawValue: bgStyleRaw) ?? .gradient }
        set { bgStyleRaw = newValue.rawValue; objectWillChange.send() }
    }

    var wireColor: Color { Color(hue: wireHue, saturation: 0.85, brightness: 0.95) }
    var bgPrimary: Color { Color(hue: bgHueA, saturation: 0.55, brightness: 0.95) }
    var bgSecondary: Color { Color(hue: bgHueB, saturation: 0.70, brightness: 0.70) }

    var bgImage: UIImage? {
        bgImageData.isEmpty ? nil : UIImage(data: bgImageData)
    }
    func clearBackgroundImage() { bgImageData = Data() }
}

// MARK: - Lock store

final class LockStore: ObservableObject {
    @AppStorage("lock.enabled")    var enabled: Bool = false
    @AppStorage("lock.passcode")   var passcode: String = ""        // 4-6 digits
    @AppStorage("lock.biometric")  var useBiometric: Bool = true

    @Published var isUnlocked: Bool

    init() {
        let isEnabled = UserDefaults.standard.bool(forKey: "lock.enabled")
        isUnlocked = !isEnabled
    }

    var biometryType: LABiometryType {
        let ctx = LAContext()
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return ctx.biometryType
    }

    func attemptBiometric(_ completion: @escaping (Bool) -> Void) {
        let ctx = LAContext()
        var err: NSError?
        guard useBiometric,
              ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err)
        else { completion(false); return }
        ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                           localizedReason: "Unlock Fidgets") { ok, _ in
            DispatchQueue.main.async { completion(ok) }
        }
    }

    func verify(passcode entered: String) -> Bool {
        guard !passcode.isEmpty else { return true }
        return entered == passcode
    }
}

// MARK: - Fidget model

enum FidgetKind: String, Codable, CaseIterable, Hashable {
    case toggle, slider, stepper, pushButton, holdButton, segmented
    case wheelPicker, menuPicker, datePicker, colorPicker
    case progress, gauge, ringGauge, counter, tally
    case knob, dial, wheelSpin, fan
    case dice, coin, cardFlip
    case bubble, popper, squish, balloon
    case ripple, wave, pulse, sparkler
    case pendulum, spring, ball, metronome
    case compass, orbit, lock, zipper
    case tapCounter, longPressTimer, scroller, stopwatch

    var displayName: String {
        switch self {
        case .toggle: return "Toggle"
        case .slider: return "Slider"
        case .stepper: return "Stepper"
        case .pushButton: return "Push"
        case .holdButton: return "Hold"
        case .segmented: return "Segmented"
        case .wheelPicker: return "Wheel"
        case .menuPicker: return "Menu"
        case .datePicker: return "Date"
        case .colorPicker: return "Color"
        case .progress: return "Progress"
        case .gauge: return "Gauge"
        case .ringGauge: return "Ring"
        case .counter: return "Counter"
        case .tally: return "Tally"
        case .knob: return "Knob"
        case .dial: return "Dial"
        case .wheelSpin: return "Spin"
        case .fan: return "Fan"
        case .dice: return "Dice"
        case .coin: return "Coin"
        case .cardFlip: return "Flip"
        case .bubble: return "Bubble"
        case .popper: return "Pop"
        case .squish: return "Squish"
        case .balloon: return "Balloon"
        case .ripple: return "Ripple"
        case .wave: return "Wave"
        case .pulse: return "Pulse"
        case .sparkler: return "Sparkle"
        case .pendulum: return "Pendulum"
        case .spring: return "Spring"
        case .ball: return "Ball"
        case .metronome: return "Beat"
        case .compass: return "Compass"
        case .orbit: return "Orbit"
        case .lock: return "Lock"
        case .zipper: return "Zip"
        case .tapCounter: return "Tap Counter"
        case .longPressTimer: return "Hold Timer"
        case .scroller: return "Scroller"
        case .stopwatch: return "Stopwatch"
        }
    }

    var systemImage: String {
        switch self {
        case .toggle: return "switch.2"
        case .slider: return "slider.horizontal.3"
        case .stepper: return "plusminus"
        case .pushButton: return "circle.fill"
        case .holdButton: return "hand.tap.fill"
        case .segmented: return "rectangle.split.3x1.fill"
        case .wheelPicker: return "scroll"
        case .menuPicker: return "list.bullet"
        case .datePicker: return "calendar"
        case .colorPicker: return "paintpalette.fill"
        case .progress: return "progress.indicator"
        case .gauge: return "gauge.with.dots.needle.50percent"
        case .ringGauge: return "circle.dashed.inset.filled"
        case .counter: return "number"
        case .tally: return "list.number"
        case .knob: return "dial.medium"
        case .dial: return "dial.high"
        case .wheelSpin: return "gearshape.fill"
        case .fan: return "fan"
        case .dice: return "dice"
        case .coin: return "circle.lefthalf.filled"
        case .cardFlip: return "rectangle.portrait.on.rectangle.portrait.angled"
        case .bubble: return "bubble"
        case .popper: return "circle.grid.3x3.fill"
        case .squish: return "drop.fill"
        case .balloon: return "balloon.fill"
        case .ripple: return "wave.3.right"
        case .wave: return "water.waves"
        case .pulse: return "waveform.path.ecg"
        case .sparkler: return "sparkles"
        case .pendulum: return "metronome"
        case .spring: return "alternatingcurrent"
        case .ball: return "circle.fill"
        case .metronome: return "metronome.fill"
        case .compass: return "location.north.line.fill"
        case .orbit: return "circle.dotted"
        case .lock: return "lock.fill"
        case .zipper: return "arrow.left.and.right"
        case .tapCounter: return "hand.tap"
        case .longPressTimer: return "hourglass"
        case .scroller: return "arrow.up.and.down"
        case .stopwatch: return "stopwatch"
        }
    }
}

struct Fidget: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var kind: FidgetKind
    var label: String
    var hue: Double
    var pinned: Bool = false
    var inGrid: Bool = true
}

// MARK: - Fidget store

final class FidgetStore: ObservableObject {
    @Published var library: [Fidget] = []
    @Published var editMode: Bool = false

    private let saveKey = "fidgets.library.v1"

    init() {
        load()
        if library.isEmpty {
            library = Self.makeDefaultLibrary()
            save()
        }
    }

    var visible: [Fidget] {
        library.filter { $0.inGrid }.sorted { lhs, rhs in
            if lhs.pinned != rhs.pinned { return lhs.pinned && !rhs.pinned }
            return false
        }
    }

    func remove(_ id: UUID) {
        guard let i = library.firstIndex(where: { $0.id == id }) else { return }
        library[i].inGrid = false
        save()
    }
    func restore(_ id: UUID) {
        guard let i = library.firstIndex(where: { $0.id == id }) else { return }
        library[i].inGrid = true
        save()
    }
    func togglePin(_ id: UUID) {
        guard let i = library.firstIndex(where: { $0.id == id }) else { return }
        library[i].pinned.toggle()
        save()
    }
    func toggleInGrid(_ id: UUID) {
        guard let i = library.firstIndex(where: { $0.id == id }) else { return }
        library[i].inGrid.toggle()
        save()
    }
    func resetLibrary() {
        library = Self.makeDefaultLibrary()
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(library) {
            UserDefaults.standard.set(data, forKey: saveKey)
        }
    }
    private func load() {
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode([Fidget].self, from: data) {
            library = decoded
        }
    }

    static func makeDefaultLibrary() -> [Fidget] {
        let kinds = FidgetKind.allCases
        var out: [Fidget] = []
        for i in 0..<120 {
            let kind = kinds[i % kinds.count]
            let variant = (i / kinds.count) + 1
            let hue = Double((i * 47) % 360) / 360.0
            out.append(Fidget(kind: kind, label: "\(kind.displayName) \(variant)", hue: hue))
        }
        return out
    }
}

// MARK: - Glass background helper (Liquid Glass on iOS 26+)

struct GlassBG<S: Shape>: ViewModifier {
    let shape: S
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: shape)
        } else {
            content
                .background(.regularMaterial, in: shape)
                .overlay(shape.stroke(.white.opacity(0.18), lineWidth: 0.5))
        }
    }
}
extension View {
    func glassBG<S: Shape>(in shape: S) -> some View { modifier(GlassBG(shape: shape)) }
}

// MARK: - Home view

struct HomeView: View {
    @EnvironmentObject var store: FidgetStore
    @EnvironmentObject var theme: ThemeStore

    @State private var showSettings = false
    @State private var showPaintbrush = false
    @State private var removeTarget: Fidget? = nil

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 14)]

    var body: some View {
        NavigationStack {
            ZStack {
                BackgroundView()
                    .ignoresSafeArea()

                ScrollView {
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(store.visible) { f in
                            FidgetCell(fidget: f,
                                       wiggle: store.editMode,
                                       onRemove: { removeTarget = f })
                        }
                    }
                    .padding(16)
                    .padding(.bottom, 80)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Fidgets")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .imageScale(.large)
                    }
                    .accessibilityLabel("Settings")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 10) {
                        if store.editMode {
                            Button("Done") {
                                withAnimation(.spring) { store.editMode = false }
                            }
                            .fontWeight(.semibold)
                        }
                        Button {
                            showPaintbrush = true
                        } label: {
                            Image(systemName: "paintbrush.fill")
                                .imageScale(.large)
                        }
                        .accessibilityLabel("Customize")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsSheet()
            }
            .sheet(isPresented: $showPaintbrush) {
                PaintbrushSheet()
                    .presentationDetents([.medium, .large])
            }
            .alert("Remove fidget?",
                   isPresented: Binding(
                    get: { removeTarget != nil },
                    set: { if !$0 { removeTarget = nil } })) {
                Button("Remove", role: .destructive) {
                    if let t = removeTarget { store.remove(t.id) }
                    removeTarget = nil
                }
                Button("Cancel", role: .cancel) { removeTarget = nil }
            } message: {
                if let t = removeTarget {
                    Text("\"\(t.label)\" will be hidden. You can add it back from Settings → Fidget Library.")
                }
            }
        }
    }
}

// MARK: - Backgrounds

struct BackgroundView: View {
    @EnvironmentObject var theme: ThemeStore

    var body: some View {
        Group {
            switch theme.bgStyle {
            case .gradient:
                LinearGradient(colors: [theme.bgPrimary, theme.bgSecondary],
                               startPoint: .topLeading,
                               endPoint: .bottomTrailing)
            case .mesh:
                MeshBackground(hueA: theme.bgHueA, hueB: theme.bgHueB)
            case .solid:
                theme.bgPrimary
            case .image:
                if let img = theme.bgImage {
                    Image(uiImage: img)
                        .resizable()
                        .scaledToFill()
                } else {
                    LinearGradient(colors: [theme.bgPrimary, theme.bgSecondary],
                                   startPoint: .topLeading,
                                   endPoint: .bottomTrailing)
                }
            }
        }
    }
}

struct MeshBackground: View {
    let hueA: Double
    let hueB: Double
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0/30.0)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            ZStack {
                Color(hue: hueA, saturation: 0.45, brightness: 0.98)
                Circle()
                    .fill(Color(hue: hueB, saturation: 0.8, brightness: 0.95).opacity(0.6))
                    .frame(width: 360, height: 360)
                    .blur(radius: 80)
                    .offset(x: CGFloat(sin(t * 0.6) * 90), y: CGFloat(cos(t * 0.4) * 60))
                Circle()
                    .fill(Color(hue: (hueA + 0.5).truncatingRemainder(dividingBy: 1.0),
                                saturation: 0.7, brightness: 1.0).opacity(0.5))
                    .frame(width: 300, height: 300)
                    .blur(radius: 90)
                    .offset(x: CGFloat(cos(t * 0.5) * -110), y: CGFloat(sin(t * 0.7) * 120))
            }
        }
    }
}

// MARK: - Cell

struct FidgetCell: View {
    let fidget: Fidget
    let wiggle: Bool
    let onRemove: () -> Void

    @EnvironmentObject var store: FidgetStore

    private var seed: Double { Double((fidget.id.uuidString.hashValue & 0xFF)) / 255.0 }

    var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: 10) {
                FidgetInteractive(fidget: fidget)
                    .frame(maxWidth: .infinity, minHeight: 86)
                HStack(spacing: 4) {
                    if fidget.pinned {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Text(fidget.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 150)
            .glassBG(in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .onLongPressGesture(minimumDuration: 0.4) {
                withAnimation(.spring) { store.editMode = true }
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
            .contextMenu {
                Button(fidget.pinned ? "Unpin" : "Pin First",
                       systemImage: fidget.pinned ? "pin.slash" : "pin") {
                    store.togglePin(fidget.id)
                }
                Button("Remove", systemImage: "trash", role: .destructive,
                       action: onRemove)
            }

            if wiggle {
                Button(action: onRemove) {
                    Image(systemName: "minus")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(Circle().fill(.black.opacity(0.75)))
                        .overlay(Circle().stroke(.white.opacity(0.8), lineWidth: 1.5))
                }
                .offset(x: -8, y: -8)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .modifier(WiggleModifier(active: wiggle, seed: seed))
    }
}

// MARK: - Wiggle modifier (jiggle like the Home Screen)

struct WiggleModifier: ViewModifier {
    let active: Bool
    let seed: Double

    func body(content: Content) -> some View {
        if active {
            TimelineView(.animation(minimumInterval: 1.0/60.0)) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                let phase = seed * 6.28
                let angle = sin(t * 10 + phase) * 1.6
                let dx = cos(t * 9 + phase) * 0.6
                let dy = sin(t * 11 + phase) * 0.6
                content
                    .rotationEffect(.degrees(angle))
                    .offset(x: dx, y: dy)
            }
        } else {
            content
        }
    }
}

// MARK: - Interactive switch board

struct FidgetInteractive: View {
    let fidget: Fidget
    var color: Color { Color(hue: fidget.hue, saturation: 0.8, brightness: 0.95) }

    var body: some View {
        switch fidget.kind {
        case .toggle:         ToggleFidget(tint: color)
        case .slider:         SliderFidget(tint: color)
        case .stepper:        StepperFidget(tint: color)
        case .pushButton:     PushButtonFidget(tint: color)
        case .holdButton:     HoldButtonFidget(tint: color)
        case .segmented:      SegmentedFidget(tint: color)
        case .wheelPicker:    WheelPickerFidget(tint: color)
        case .menuPicker:     MenuPickerFidget(tint: color)
        case .datePicker:     DatePickerFidget(tint: color)
        case .colorPicker:    ColorPickerFidget(tint: color)
        case .progress:       ProgressFidget(tint: color)
        case .gauge:          GaugeFidget(tint: color)
        case .ringGauge:      RingGaugeFidget(tint: color)
        case .counter:        CounterFidget(tint: color)
        case .tally:          TallyFidget(tint: color)
        case .knob:           KnobFidget(tint: color)
        case .dial:           DialFidget(tint: color)
        case .wheelSpin:      WheelSpinFidget(tint: color)
        case .fan:            FanFidget(tint: color)
        case .dice:           DiceFidget(tint: color)
        case .coin:           CoinFidget(tint: color)
        case .cardFlip:       CardFlipFidget(tint: color)
        case .bubble:         BubbleFidget(tint: color)
        case .popper:         PopperFidget(tint: color)
        case .squish:         SquishFidget(tint: color)
        case .balloon:        BalloonFidget(tint: color)
        case .ripple:         RippleFidget(tint: color)
        case .wave:           WaveFidget(tint: color)
        case .pulse:          PulseFidget(tint: color)
        case .sparkler:       SparklerFidget(tint: color)
        case .pendulum:       PendulumFidget(tint: color)
        case .spring:         SpringFidget(tint: color)
        case .ball:           BallFidget(tint: color)
        case .metronome:      MetronomeFidget(tint: color)
        case .compass:        CompassFidget(tint: color)
        case .orbit:          OrbitFidget(tint: color)
        case .lock:           LockFidget(tint: color)
        case .zipper:         ZipperFidget(tint: color)
        case .tapCounter:     TapCounterFidget(tint: color)
        case .longPressTimer: LongPressFidget(tint: color)
        case .scroller:       ScrollerFidget(tint: color)
        case .stopwatch:      StopwatchFidget(tint: color)
        }
    }
}

// MARK: - Individual fidgets

struct ToggleFidget: View {
    let tint: Color
    @State private var on = false
    var body: some View {
        Toggle(isOn: $on) { EmptyView() }
            .labelsHidden()
            .tint(tint)
            .scaleEffect(1.2)
    }
}

struct SliderFidget: View {
    let tint: Color
    @State private var v: Double = 0.5
    var body: some View {
        Slider(value: $v).tint(tint).padding(.horizontal, 4)
    }
}

struct StepperFidget: View {
    let tint: Color
    @State private var v: Int = 5
    var body: some View {
        VStack {
            Text("\(v)").font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
            Stepper("", value: $v, in: -99...99).labelsHidden()
        }
    }
}

struct PushButtonFidget: View {
    let tint: Color
    @State private var taps = 0
    @State private var pressed = false
    var body: some View {
        Button {
            taps += 1
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            Text("\(taps)")
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background(Circle().fill(tint.gradient))
                .shadow(color: tint.opacity(0.45), radius: pressed ? 2 : 10, y: pressed ? 1 : 6)
                .scaleEffect(pressed ? 0.9 : 1)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in withAnimation(.spring(duration: 0.2)) { pressed = false } }
        )
    }
}

struct HoldButtonFidget: View {
    let tint: Color
    @State private var holding = false
    @State private var progress: Double = 0
    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.25), lineWidth: 6)
            Circle().trim(from: 0, to: progress)
                .stroke(tint, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Image(systemName: "hand.tap.fill").foregroundStyle(tint).font(.title2)
        }
        .frame(width: 64, height: 64)
        .gesture(
            LongPressGesture(minimumDuration: 1.5)
                .onChanged { _ in
                    holding = true
                    withAnimation(.linear(duration: 1.5)) { progress = 1 }
                }
                .onEnded { _ in
                    holding = false
                    withAnimation(.easeOut(duration: 0.4)) { progress = 0 }
                }
        )
    }
}

struct SegmentedFidget: View {
    let tint: Color
    @State private var sel = 1
    var body: some View {
        Picker("", selection: $sel) {
            Text("A").tag(0); Text("B").tag(1); Text("C").tag(2)
        }
        .pickerStyle(.segmented)
        .tint(tint)
    }
}

struct WheelPickerFidget: View {
    let tint: Color
    @State private var sel = 3
    var body: some View {
        Picker("", selection: $sel) {
            ForEach(0..<10) { Text("\($0)").tag($0) }
        }
        .pickerStyle(.wheel)
        .frame(height: 80).clipped()
        .tint(tint)
    }
}

struct MenuPickerFidget: View {
    let tint: Color
    @State private var sel = "Apple"
    private let opts = ["Apple", "Pear", "Plum", "Fig", "Lime"]
    var body: some View {
        Menu {
            ForEach(opts, id: \.self) { o in
                Button(o) { sel = o }
            }
        } label: {
            HStack {
                Text(sel).fontWeight(.semibold)
                Image(systemName: "chevron.up.chevron.down").font(.caption)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(Capsule().fill(tint.opacity(0.2)))
            .foregroundStyle(tint)
        }
    }
}

struct DatePickerFidget: View {
    let tint: Color
    @State private var date = Date()
    var body: some View {
        DatePicker("", selection: $date, displayedComponents: .date)
            .labelsHidden()
            .datePickerStyle(.compact)
            .tint(tint)
    }
}

struct ColorPickerFidget: View {
    let tint: Color
    @State private var c: Color
    init(tint: Color) { self.tint = tint; _c = State(initialValue: tint) }
    var body: some View {
        ColorPicker("", selection: $c, supportsOpacity: false)
            .labelsHidden()
            .scaleEffect(1.4)
    }
}

struct ProgressFidget: View {
    let tint: Color
    @State private var v: Double = 0
    var body: some View {
        ProgressView(value: v)
            .tint(tint)
            .padding(.horizontal, 6)
            .onAppear {
                withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                    v = 1
                }
            }
    }
}

struct GaugeFidget: View {
    let tint: Color
    @State private var v: Double = 0.5
    var body: some View {
        Gauge(value: v) { EmptyView() }
            .gaugeStyle(.accessoryCircular)
            .tint(tint)
            .scaleEffect(1.6)
            .onTapGesture {
                withAnimation(.spring) { v = .random(in: 0...1) }
            }
    }
}

struct RingGaugeFidget: View {
    let tint: Color
    @State private var v: Double = 0.7
    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.2), lineWidth: 8)
            Circle().trim(from: 0, to: v)
                .stroke(tint.gradient, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(v * 100))%")
                .font(.system(.caption, design: .rounded).weight(.heavy))
                .foregroundStyle(tint)
        }
        .frame(width: 70, height: 70)
        .onTapGesture {
            withAnimation(.spring) { v = .random(in: 0.05...1) }
        }
    }
}

struct CounterFidget: View {
    let tint: Color
    @State private var n = 0
    var body: some View {
        HStack(spacing: 14) {
            Button { n -= 1 } label: {
                Image(systemName: "minus.circle.fill").font(.title)
            }
            Text("\(n)").font(.system(.title2, design: .rounded).weight(.heavy))
                .frame(minWidth: 36)
            Button { n += 1 } label: {
                Image(systemName: "plus.circle.fill").font(.title)
            }
        }
        .tint(tint)
    }
}

struct TallyFidget: View {
    let tint: Color
    @State private var c = 0
    var body: some View {
        Button {
            c += 1
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            VStack {
                Text("\(c)").font(.system(.title, design: .rounded).weight(.heavy))
                Text("tap").font(.caption2).foregroundStyle(.secondary)
            }
            .frame(width: 80, height: 70)
            .background(RoundedRectangle(cornerRadius: 14).fill(tint.opacity(0.18)))
            .foregroundStyle(tint)
        }
        .buttonStyle(.plain)
    }
}

struct KnobFidget: View {
    let tint: Color
    @State private var angle: Double = -120
    var body: some View {
        ZStack {
            Circle().fill(tint.opacity(0.18))
            Circle().stroke(tint, lineWidth: 2)
            Capsule()
                .fill(tint)
                .frame(width: 4, height: 22)
                .offset(y: -16)
                .rotationEffect(.degrees(angle))
        }
        .frame(width: 70, height: 70)
        .gesture(
            DragGesture()
                .onChanged { v in
                    let dx = v.translation.width
                    let dy = v.translation.height
                    angle = atan2(dy, dx) * 180 / .pi
                }
        )
    }
}

struct DialFidget: View {
    let tint: Color
    @State private var rotation: Double = 0
    @State private var last: Double = 0
    var body: some View {
        ZStack {
            Circle().fill(tint.gradient.opacity(0.35))
            ForEach(0..<12, id: \.self) { i in
                Capsule().fill(tint).frame(width: 3, height: 9)
                    .offset(y: -28)
                    .rotationEffect(.degrees(Double(i) * 30))
            }
        }
        .frame(width: 76, height: 76)
        .rotationEffect(.degrees(rotation))
        .gesture(
            DragGesture()
                .onChanged { v in
                    let delta = (v.translation.width + v.translation.height) - last
                    rotation += delta
                    last = v.translation.width + v.translation.height
                }
                .onEnded { _ in last = 0 }
        )
    }
}

struct WheelSpinFidget: View {
    let tint: Color
    @State private var rotation: Double = 0
    var body: some View {
        Button {
            withAnimation(.spring(response: 1.6, dampingFraction: 0.55)) {
                rotation += Double.random(in: 540...1440)
            }
        } label: {
            ZStack {
                ForEach(0..<8, id: \.self) { i in
                    Triangle()
                        .fill(i.isMultiple(of: 2) ? tint : tint.opacity(0.5))
                        .frame(width: 60, height: 32)
                        .offset(y: -16)
                        .rotationEffect(.degrees(Double(i) * 45))
                }
                Circle().fill(.white).frame(width: 14, height: 14)
            }
            .frame(width: 80, height: 80)
            .rotationEffect(.degrees(rotation))
        }
        .buttonStyle(.plain)
    }
}

struct Triangle: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.midX, y: r.minY))
        p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

struct FanFidget: View {
    let tint: Color
    @State private var spinning = false
    var body: some View {
        Button { spinning.toggle() } label: {
            Image(systemName: "fan.fill")
                .font(.system(size: 50))
                .foregroundStyle(tint.gradient)
                .rotationEffect(.degrees(spinning ? 360 : 0))
                .animation(spinning ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default,
                           value: spinning)
        }
        .buttonStyle(.plain)
    }
}

struct DiceFidget: View {
    let tint: Color
    @State private var face = 1
    @State private var spin = 0.0
    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.4)) { spin += 360 }
            face = Int.random(in: 1...6)
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        } label: {
            Image(systemName: "die.face.\(face).fill")
                .font(.system(size: 56))
                .foregroundStyle(tint)
                .rotation3DEffect(.degrees(spin), axis: (1, 1, 0))
        }
        .buttonStyle(.plain)
    }
}

struct CoinFidget: View {
    let tint: Color
    @State private var flipped = false
    @State private var spin = 0.0
    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.7)) { spin += 720 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { flipped.toggle() }
        } label: {
            ZStack {
                Circle().fill(tint.gradient)
                    .frame(width: 64, height: 64)
                    .shadow(color: tint.opacity(0.4), radius: 6)
                Text(flipped ? "T" : "H")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            .rotation3DEffect(.degrees(spin), axis: (1, 0, 0))
        }
        .buttonStyle(.plain)
    }
}

struct CardFlipFidget: View {
    let tint: Color
    @State private var face = false
    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.6)) { face.toggle() }
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(face ? tint.gradient : tint.opacity(0.25).gradient)
                Image(systemName: face ? "suit.heart.fill" : "questionmark")
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(face ? .white : tint)
            }
            .frame(width: 60, height: 80)
            .rotation3DEffect(.degrees(face ? 180 : 0), axis: (0, 1, 0))
            .scaleEffect(x: face ? -1 : 1, y: 1)
        }
        .buttonStyle(.plain)
    }
}

struct BubbleFidget: View {
    let tint: Color
    @State private var popped = false
    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.35)) { popped.toggle() }
        } label: {
            Image(systemName: popped ? "circle" : "circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(tint.gradient)
                .scaleEffect(popped ? 0.7 : 1.0)
        }
        .buttonStyle(.plain)
    }
}

struct PopperFidget: View {
    let tint: Color
    @State private var pops: Set<Int> = []
    var body: some View {
        let grid = Array(0..<9)
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3),
                  spacing: 4) {
            ForEach(grid, id: \.self) { i in
                Button {
                    if pops.contains(i) { pops.remove(i) } else { pops.insert(i) }
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                } label: {
                    Circle()
                        .fill(pops.contains(i) ? tint.opacity(0.25) : tint.gradient.opacity(1))
                        .frame(height: 22)
                        .scaleEffect(pops.contains(i) ? 0.75 : 1)
                        .animation(.spring(duration: 0.25), value: pops.contains(i))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(width: 90)
    }
}

struct SquishFidget: View {
    let tint: Color
    @State private var pressed = false
    var body: some View {
        RoundedRectangle(cornerRadius: 28)
            .fill(tint.gradient)
            .frame(width: pressed ? 90 : 70, height: pressed ? 50 : 70)
            .shadow(color: tint.opacity(0.4), radius: 6, y: 4)
            .animation(.spring(response: 0.3, dampingFraction: 0.45), value: pressed)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in pressed = true }
                    .onEnded { _ in pressed = false }
            )
    }
}

struct BalloonFidget: View {
    let tint: Color
    @State private var size: CGFloat = 30
    var body: some View {
        Button {
            withAnimation(.spring) {
                size = size > 80 ? 30 : size + 12
            }
        } label: {
            Image(systemName: "balloon.fill")
                .resizable().scaledToFit()
                .foregroundStyle(tint.gradient)
                .frame(width: size, height: size + 10)
        }
        .buttonStyle(.plain)
    }
}

struct RippleFidget: View {
    let tint: Color
    @State private var ripples: [UUID] = []
    var body: some View {
        ZStack {
            ForEach(ripples, id: \.self) { id in
                RippleCircle(tint: tint) {
                    ripples.removeAll { $0 == id }
                }
            }
            Image(systemName: "hand.point.up.left.fill")
                .font(.title2)
                .foregroundStyle(tint)
        }
        .frame(width: 100, height: 80)
        .contentShape(Rectangle())
        .onTapGesture { ripples.append(UUID()) }
    }
}
struct RippleCircle: View {
    let tint: Color
    let onDone: () -> Void
    @State private var scale: CGFloat = 0.1
    @State private var opacity: Double = 1
    var body: some View {
        Circle()
            .stroke(tint, lineWidth: 2)
            .frame(width: 60, height: 60)
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 0.8)) {
                    scale = 2.2; opacity = 0
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.85, execute: onDone)
            }
    }
}

struct WaveFidget: View {
    let tint: Color
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                var path = Path()
                let w = size.width, h = size.height
                path.move(to: CGPoint(x: 0, y: h / 2))
                for x in stride(from: 0.0, through: w, by: 2) {
                    let y = h / 2 + sin(x / 18 + t * 2) * (h / 4)
                    path.addLine(to: CGPoint(x: x, y: y))
                }
                ctx.stroke(path, with: .color(tint), lineWidth: 3)
            }
        }
        .frame(height: 70)
    }
}

struct PulseFidget: View {
    let tint: Color
    @State private var on = true
    var body: some View {
        Circle()
            .fill(tint)
            .frame(width: 36, height: 36)
            .scaleEffect(on ? 1.6 : 1.0)
            .opacity(on ? 0.4 : 1)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: on)
            .onAppear { on.toggle() }
    }
}

struct SparklerFidget: View {
    let tint: Color
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/20)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            ZStack {
                ForEach(0..<8, id: \.self) { i in
                    let p = Double(i) / 8
                    Image(systemName: "sparkle")
                        .font(.system(size: 14 + CGFloat(sin(t * 4 + p * 8) * 6)))
                        .foregroundStyle(tint)
                        .offset(x: cos((t + p * 2) * 1.5) * 28,
                                y: sin((t + p * 2) * 1.5) * 22)
                        .opacity(0.6 + sin(t * 5 + p * 9) * 0.4)
                }
            }
        }
        .frame(height: 70)
    }
}

struct PendulumFidget: View {
    let tint: Color
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            let angle = sin(t * 2.6) * 30
            ZStack(alignment: .top) {
                Rectangle().fill(tint.opacity(0.5)).frame(width: 2, height: 55)
                Circle().fill(tint).frame(width: 18, height: 18).offset(y: 50)
            }
            .rotationEffect(.degrees(angle), anchor: .top)
            .frame(height: 75)
        }
    }
}

struct SpringFidget: View {
    let tint: Color
    @State private var s: CGFloat = 0
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<6) { _ in
                Capsule().fill(tint).frame(width: 30, height: 4)
            }
        }
        .scaleEffect(y: 1 + s, anchor: .top)
        .frame(height: 70)
        .gesture(
            DragGesture()
                .onChanged { v in s = min(max(v.translation.height / 100, -0.3), 1.5) }
                .onEnded { _ in withAnimation(.spring(response: 0.4, dampingFraction: 0.35)) { s = 0 } }
        )
    }
}

struct BallFidget: View {
    let tint: Color
    @State private var pos: CGFloat = 0
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/60)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            let y = abs(sin(t * 3)) * -40
            Circle()
                .fill(tint.gradient)
                .frame(width: 26, height: 26)
                .offset(y: y)
                .shadow(color: tint.opacity(0.4), radius: 4, y: -y / 4)
        }
        .frame(height: 70)
    }
}

struct MetronomeFidget: View {
    let tint: Color
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            let angle = sin(t * 5) * 22
            ZStack(alignment: .bottom) {
                Triangle()
                    .fill(tint.opacity(0.3))
                    .frame(width: 50, height: 60)
                Rectangle().fill(tint).frame(width: 3, height: 55)
                    .rotationEffect(.degrees(angle), anchor: .bottom)
                Circle().fill(tint).frame(width: 10, height: 10)
                    .offset(y: -20)
                    .rotationEffect(.degrees(angle), anchor: .bottom)
                    .offset(y: 35)
            }
            .frame(height: 70)
        }
    }
}

struct CompassFidget: View {
    let tint: Color
    @State private var angle: Double = 0
    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.4), lineWidth: 2)
            Image(systemName: "location.north.fill")
                .font(.title2)
                .foregroundStyle(tint)
                .rotationEffect(.degrees(angle))
        }
        .frame(width: 70, height: 70)
        .onTapGesture {
            withAnimation(.spring(duration: 0.8)) {
                angle += Double.random(in: 90...720)
            }
        }
    }
}

struct OrbitFidget: View {
    let tint: Color
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            ZStack {
                Circle().stroke(tint.opacity(0.25), lineWidth: 1).frame(width: 70, height: 70)
                Circle().fill(tint).frame(width: 14, height: 14)
                Circle().fill(tint.opacity(0.7)).frame(width: 8, height: 8)
                    .offset(x: cos(t * 1.8) * 28, y: sin(t * 1.8) * 28)
                Circle().fill(tint.opacity(0.5)).frame(width: 6, height: 6)
                    .offset(x: cos(t * 2.6 + 1.5) * 34, y: sin(t * 2.6 + 1.5) * 34)
            }
        }
        .frame(height: 80)
    }
}

struct LockFidget: View {
    let tint: Color
    @State private var unlocked = false
    @State private var drag: CGFloat = 0
    var body: some View {
        ZStack(alignment: .leading) {
            Capsule().fill(tint.opacity(0.2)).frame(height: 36)
            Capsule().fill(tint.opacity(0.5))
                .frame(width: max(36, drag + 36), height: 36)
            HStack {
                Image(systemName: unlocked ? "lock.open.fill" : "lock.fill")
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(tint))
                    .offset(x: drag)
                Spacer()
            }
            HStack { Spacer(); Text(unlocked ? "Unlocked" : "Slide")
                    .font(.caption2.bold()).foregroundStyle(.secondary).padding(.trailing, 12) }
        }
        .frame(width: 120)
        .gesture(
            DragGesture()
                .onChanged { v in drag = min(max(0, v.translation.width), 78) }
                .onEnded { v in
                    if v.translation.width > 60 {
                        unlocked.toggle()
                    }
                    withAnimation(.spring) { drag = 0 }
                }
        )
    }
}

struct ZipperFidget: View {
    let tint: Color
    @State private var open: CGFloat = 0
    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<10) { i in
                let p = CGFloat(i) / 10
                Capsule().fill(tint.opacity(open > p ? 0.2 : 1))
                    .frame(width: 6, height: 26)
            }
        }
        .gesture(
            DragGesture()
                .onChanged { v in open = min(max(0, v.translation.width / 100), 1) }
        )
    }
}

struct TapCounterFidget: View {
    let tint: Color
    @State private var n = 0
    var body: some View {
        Button {
            n += 1
            UISelectionFeedbackGenerator().selectionChanged()
        } label: {
            VStack(spacing: 2) {
                Image(systemName: "hand.tap.fill").foregroundStyle(tint)
                Text("\(n)").font(.system(.title3, design: .rounded).weight(.bold))
            }
            .frame(width: 80, height: 70)
            .background(RoundedRectangle(cornerRadius: 14).fill(tint.opacity(0.18)))
        }
        .buttonStyle(.plain)
    }
}

struct LongPressFidget: View {
    let tint: Color
    @State private var t: Double = 0
    @State private var holding = false
    var body: some View {
        VStack {
            Text(String(format: "%.1fs", t))
                .font(.system(.title3, design: .monospaced).weight(.bold))
                .foregroundStyle(tint)
            Image(systemName: "hand.point.up.left.fill")
                .foregroundStyle(holding ? tint : .secondary)
        }
        .frame(width: 80, height: 70)
        .background(RoundedRectangle(cornerRadius: 14).fill(tint.opacity(0.15)))
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !holding {
                        holding = true
                        t = 0
                        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { tmr in
                            if !holding { tmr.invalidate(); return }
                            t += 0.1
                        }
                    }
                }
                .onEnded { _ in holding = false }
        )
    }
}

struct ScrollerFidget: View {
    let tint: Color
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(0..<30) { i in
                    Circle().fill(tint.opacity(0.4 + Double(i % 7) / 12))
                        .frame(width: 22, height: 22)
                }
            }
            .padding(.horizontal, 6)
        }
        .frame(height: 50)
    }
}

struct StopwatchFidget: View {
    let tint: Color
    @State private var running = false
    @State private var t: Double = 0
    @State private var timer: Timer?
    var body: some View {
        VStack(spacing: 4) {
            Text(String(format: "%.1f", t))
                .font(.system(.title3, design: .monospaced).weight(.heavy))
                .foregroundStyle(tint)
            HStack(spacing: 14) {
                Button {
                    running.toggle()
                    if running {
                        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
                            t += 0.1
                        }
                    } else {
                        timer?.invalidate()
                    }
                } label: {
                    Image(systemName: running ? "pause.fill" : "play.fill")
                        .foregroundStyle(.white).padding(8)
                        .background(Circle().fill(tint))
                }
                Button {
                    running = false; timer?.invalidate(); t = 0
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .foregroundStyle(tint)
                }
            }
        }
    }
}

// MARK: - Paintbrush sheet

struct PaintbrushSheet: View {
    @EnvironmentObject var theme: ThemeStore
    @Environment(\.dismiss) private var dismiss

    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            Form {
                Section("Wire Color") {
                    HueSlider(hue: $theme.wireHue)
                    HStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(theme.wireColor)
                            .frame(width: 40, height: 28)
                        Text("Accent")
                        Spacer()
                    }
                }
                Section("Background") {
                    Picker("Style", selection: Binding(
                        get: { theme.bgStyle },
                        set: { theme.bgStyle = $0 })) {
                        ForEach(BackgroundStyle.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    if theme.bgStyle != .image {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Primary hue").font(.caption).foregroundStyle(.secondary)
                            HueSlider(hue: $theme.bgHueA)
                            if theme.bgStyle != .solid {
                                Text("Secondary hue").font(.caption).foregroundStyle(.secondary)
                                HueSlider(hue: $theme.bgHueB)
                            }
                        }
                    }

                    if theme.bgStyle == .image {
                        PhotosPicker(selection: $pickerItem, matching: .images) {
                            Label("Choose Image", systemImage: "photo.on.rectangle.angled")
                        }
                        if theme.bgImage != nil {
                            Button(role: .destructive) {
                                theme.clearBackgroundImage()
                            } label: {
                                Label("Remove Image", systemImage: "trash")
                            }
                        }
                    }
                }
                Section("Appearance") {
                    Picker("Appearance", selection: Binding(
                        get: { theme.appearance },
                        set: { theme.appearance = $0 })) {
                        ForEach(Appearance.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    BackgroundPreview()
                        .frame(height: 140)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                } header: {
                    Text("Preview")
                }
            }
            .navigationTitle("Customize")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self) {
                        await MainActor.run { theme.bgImageData = data }
                    }
                }
            }
        }
    }
}

struct BackgroundPreview: View {
    @EnvironmentObject var theme: ThemeStore
    var body: some View {
        ZStack {
            BackgroundView()
            VStack(spacing: 10) {
                Toggle("", isOn: .constant(true)).labelsHidden().tint(theme.wireColor).scaleEffect(1.1)
                Slider(value: .constant(0.6)).tint(theme.wireColor).frame(width: 140)
            }
            .padding()
            .glassBG(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

struct HueSlider: View {
    @Binding var hue: Double
    var body: some View {
        ZStack(alignment: .leading) {
            LinearGradient(colors: (0...10).map { Color(hue: Double($0) / 10, saturation: 0.85, brightness: 1) },
                           startPoint: .leading, endPoint: .trailing)
                .frame(height: 22)
                .clipShape(Capsule())
            GeometryReader { proxy in
                Circle()
                    .fill(Color(hue: hue, saturation: 0.9, brightness: 1))
                    .frame(width: 26, height: 26)
                    .overlay(Circle().stroke(.white, lineWidth: 2))
                    .offset(x: proxy.size.width * hue - 13, y: -2)
                    .gesture(
                        DragGesture()
                            .onChanged { v in
                                hue = min(max(0, v.location.x / proxy.size.width), 1)
                            }
                    )
            }
            .frame(height: 22)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Settings sheet

struct SettingsSheet: View {
    @EnvironmentObject var lock: LockStore
    @EnvironmentObject var store: FidgetStore
    @EnvironmentObject var theme: ThemeStore
    @Environment(\.dismiss) private var dismiss

    @State private var showLibrary = false
    @State private var showIcons = false
    @State private var showPasscode = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Picker("Theme", selection: Binding(
                        get: { theme.appearance },
                        set: { theme.appearance = $0 })) {
                        ForEach(Appearance.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                }
                Section("Library") {
                    Button {
                        showLibrary = true
                    } label: {
                        Label("Fidget Library", systemImage: "square.grid.3x3.fill")
                    }
                    Button {
                        showIcons = true
                    } label: {
                        Label("App Icon", systemImage: "app.gift.fill")
                    }
                }
                Section("Privacy") {
                    Button {
                        showPasscode = true
                    } label: {
                        HStack {
                            Label("Passcode & Biometrics", systemImage: "lock.shield.fill")
                            Spacer()
                            Text(lock.enabled ? "On" : "Off")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Section {
                    Button(role: .destructive) {
                        store.resetLibrary()
                    } label: {
                        Label("Reset Library", systemImage: "arrow.counterclockwise")
                    }
                }
                Section {
                    HStack {
                        Spacer()
                        VStack(spacing: 2) {
                            Text("Fidgets").font(.headline)
                            Text("120 little toys, all in one place.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showLibrary) { LibrarySheet() }
            .sheet(isPresented: $showIcons)   { AppIconSheet() }
            .sheet(isPresented: $showPasscode){ PasscodeSetupSheet() }
        }
    }
}

// MARK: - Library sheet

struct LibrarySheet: View {
    @EnvironmentObject var store: FidgetStore
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var filtered: [Fidget] {
        if query.isEmpty { return store.library }
        return store.library.filter {
            $0.label.localizedCaseInsensitiveContains(query)
            || $0.kind.displayName.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Text("On home")
                        Spacer()
                        Text("\(store.library.filter{ $0.inGrid }.count) of \(store.library.count)")
                            .foregroundStyle(.secondary)
                    }
                }
                ForEach(filtered) { f in
                    HStack(spacing: 12) {
                        Image(systemName: f.kind.systemImage)
                            .font(.title3)
                            .foregroundStyle(Color(hue: f.hue, saturation: 0.8, brightness: 0.95))
                            .frame(width: 30)
                        VStack(alignment: .leading) {
                            Text(f.label).font(.body)
                            Text(f.kind.displayName)
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if f.pinned {
                            Image(systemName: "pin.fill")
                                .foregroundStyle(.secondary)
                                .font(.caption)
                                .onTapGesture { store.togglePin(f.id) }
                        } else {
                            Image(systemName: "pin")
                                .foregroundStyle(.tertiary)
                                .font(.caption)
                                .onTapGesture { store.togglePin(f.id) }
                        }
                        Toggle("", isOn: Binding(
                            get: { f.inGrid },
                            set: { _ in store.toggleInGrid(f.id) }
                        ))
                        .labelsHidden()
                    }
                }
            }
            .searchable(text: $query, prompt: "Search fidgets")
            .navigationTitle("Fidget Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }
}

// MARK: - App icon sheet

struct AppIconOption: Identifiable, Hashable {
    let id: String   // alternate icon name (or "" for primary)
    let label: String
    let tintHue: Double
}

struct AppIconSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var current: String = ""
    @State private var error: String?

    private let icons: [AppIconOption] = [
        AppIconOption(id: "",                label: "Classic", tintHue: 0.58),
        AppIconOption(id: "AppIcon-Mint",    label: "Mint",    tintHue: 0.40),
        AppIconOption(id: "AppIcon-Coral",   label: "Coral",   tintHue: 0.03),
        AppIconOption(id: "AppIcon-Indigo",  label: "Indigo",  tintHue: 0.70),
        AppIconOption(id: "AppIcon-Slate",   label: "Slate",   tintHue: 0.62),
        AppIconOption(id: "AppIcon-Sunset",  label: "Sunset",  tintHue: 0.08),
    ]

    private let columns = [GridItem(.adaptive(minimum: 110), spacing: 16)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(icons) { opt in
                        Button {
                            setIcon(opt.id)
                        } label: {
                            VStack(spacing: 8) {
                                IconPreview(hue: opt.tintHue, label: opt.label)
                                    .frame(width: 90, height: 90)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(current == opt.id ? Color.accentColor : .clear,
                                                    lineWidth: 3)
                                    )
                                Text(opt.label).font(.callout)
                                if current == opt.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.tint)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
                if let error {
                    Text(error).font(.caption).foregroundStyle(.red).padding(.horizontal)
                }
            }
            .navigationTitle("App Icon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .onAppear {
                current = UIApplication.shared.alternateIconName ?? ""
            }
        }
    }

    private func setIcon(_ name: String) {
        guard UIApplication.shared.supportsAlternateIcons else {
            error = "This device doesn't support alternate icons."
            return
        }
        let target: String? = name.isEmpty ? nil : name
        UIApplication.shared.setAlternateIconName(target) { err in
            DispatchQueue.main.async {
                if let err {
                    error = "Couldn't switch icon: \(err.localizedDescription). Make sure '\(name)' is listed in Info.plist."
                } else {
                    error = nil
                    current = name
                }
            }
        }
    }
}

struct IconPreview: View {
    let hue: Double
    let label: String
    var body: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(LinearGradient(colors: [
                Color(hue: hue, saturation: 0.85, brightness: 1),
                Color(hue: (hue + 0.08).truncatingRemainder(dividingBy: 1.0),
                      saturation: 0.95, brightness: 0.75)
            ], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(
                Image(systemName: "switch.2")
                    .font(.system(size: 36, weight: .heavy))
                    .foregroundStyle(.white)
            )
    }
}

// MARK: - Passcode setup

struct PasscodeSetupSheet: View {
    @EnvironmentObject var lock: LockStore
    @Environment(\.dismiss) private var dismiss

    @State private var firstEntry = ""
    @State private var stage: Stage = .menu
    @State private var error: String?

    enum Stage { case menu, enterOld, enterNew, confirmNew }

    var body: some View {
        NavigationStack {
            Form {
                Section("Lock") {
                    Toggle("Require Passcode", isOn: Binding(
                        get: { lock.enabled },
                        set: { newValue in
                            if newValue {
                                if lock.passcode.isEmpty {
                                    stage = .enterNew
                                } else {
                                    lock.enabled = true
                                }
                            } else {
                                lock.enabled = false
                            }
                        }))

                    let bio = lock.biometryType
                    if bio == .faceID || bio == .touchID {
                        Toggle(bio == .faceID ? "Use Face ID" : "Use Touch ID",
                               isOn: $lock.useBiometric)
                            .disabled(!lock.enabled)
                    }
                }

                if !lock.passcode.isEmpty {
                    Section {
                        Button("Change Passcode") { stage = .enterOld }
                        Button("Remove Passcode", role: .destructive) {
                            lock.passcode = ""
                            lock.enabled = false
                        }
                    }
                }

                if stage != .menu {
                    Section(header: Text(prompt)) {
                        PinEntry(length: 4) { entered in
                            handle(entered: entered)
                        }
                        if let error {
                            Text(error).foregroundStyle(.red).font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("Passcode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private var prompt: String {
        switch stage {
        case .menu:        return ""
        case .enterOld:    return "Enter current passcode"
        case .enterNew:    return "Enter a new 4-digit passcode"
        case .confirmNew:  return "Re-enter to confirm"
        }
    }

    private func handle(entered: String) {
        switch stage {
        case .menu: break
        case .enterOld:
            if entered == lock.passcode {
                error = nil
                stage = .enterNew
            } else {
                error = "Wrong passcode."
            }
        case .enterNew:
            firstEntry = entered
            stage = .confirmNew
        case .confirmNew:
            if entered == firstEntry {
                lock.passcode = entered
                lock.enabled = true
                error = nil
                firstEntry = ""
                stage = .menu
            } else {
                error = "Passcodes didn't match."
                firstEntry = ""
                stage = .enterNew
            }
        }
    }
}

// A simple PIN entry that uses .keyboardType(.numberPad)
struct PinEntry: View {
    let length: Int
    let onCommit: (String) -> Void

    @State private var text: String = ""
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 12) {
            ForEach(0..<length, id: \.self) { i in
                let filled = i < text.count
                Circle()
                    .fill(filled ? Color.accentColor : Color.secondary.opacity(0.3))
                    .frame(width: 16, height: 16)
            }
            Spacer()
            Button("Submit") {
                if text.count == length {
                    let v = text
                    text = ""
                    onCommit(v)
                }
            }
            .disabled(text.count != length)
        }
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        .background(
            TextField("", text: $text)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .opacity(0.01)
                .onChange(of: text) { _, new in
                    text = String(new.filter { $0.isNumber }.prefix(length))
                }
        )
    }
}

// MARK: - Lock screen

struct LockScreen: View {
    @EnvironmentObject var lock: LockStore
    @State private var text = ""
    @State private var error: String?

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black.opacity(0.85), .black.opacity(0.95)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(.white)
                Text("Fidgets is locked")
                    .font(.headline)
                    .foregroundStyle(.white)

                if !lock.passcode.isEmpty {
                    PinEntry(length: 4) { entered in
                        if lock.verify(passcode: entered) {
                            lock.isUnlocked = true
                        } else {
                            error = "Wrong passcode"
                        }
                    }
                    .padding()
                    .glassBG(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .padding(.horizontal, 40)
                }

                if let error {
                    Text(error).foregroundStyle(.red).font(.caption)
                }

                Button {
                    lock.attemptBiometric { ok in
                        if ok { lock.isUnlocked = true }
                        else { error = "Authentication failed" }
                    }
                } label: {
                    Label(biometricLabel,
                          systemImage: biometricIcon)
                        .font(.headline)
                        .padding(.horizontal, 24).padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(.white.opacity(0.2))
                .foregroundStyle(.white)
            }
            .padding(40)
        }
        .onAppear {
            lock.attemptBiometric { ok in
                if ok { lock.isUnlocked = true }
            }
        }
    }

    private var biometricLabel: String {
        switch lock.biometryType {
        case .faceID:  return "Use Face ID"
        case .touchID: return "Use Touch ID"
        default:       return "Try again"
        }
    }
    private var biometricIcon: String {
        switch lock.biometryType {
        case .faceID:  return "faceid"
        case .touchID: return "touchid"
        default:       return "lock.open.fill"
        }
    }
}
