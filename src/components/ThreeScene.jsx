import React, { useEffect, useRef } from 'react';

const ThreeScene = ({ isVisible = true }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const geometryRef = useRef(null);
  const materialRef = useRef(null);
  const meshRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const currentRotationRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!window.THREE || !mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // シーンの作成
    const scene = new window.THREE.Scene();
    scene.background = new window.THREE.Color(0xf8fafc); // 背景色をライトグレーに
    sceneRef.current = scene;

    // カメラの作成
    const camera = new window.THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // レンダラーの作成
    const renderer = new window.THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = window.THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    // ライティング
    const ambientLight = new window.THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new window.THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 複数の3Dオブジェクトを作成
    const objects = [];
    
    // 中央のメインキューブ（大きめ）
    const mainGeometry = new window.THREE.BoxGeometry(1.5, 1.5, 1.5);
    const mainMaterial = new window.THREE.MeshPhongMaterial({ 
      color: 0x3b82f6, // 青色
      shininess: 100
    });
    const mainMesh = new window.THREE.Mesh(mainGeometry, mainMaterial);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    scene.add(mainMesh);
    objects.push({ mesh: mainMesh, speed: 1, offset: 0 });

    // 周りの小さなオブジェクト
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b, 0xeb4d4b];
    const geometries = [
      () => new window.THREE.SphereGeometry(0.3, 32, 32),
      () => new window.THREE.ConeGeometry(0.3, 0.8, 8),
      () => new window.THREE.CylinderGeometry(0.3, 0.3, 0.8, 8),
      () => new window.THREE.OctahedronGeometry(0.4),
      () => new window.THREE.TetrahedronGeometry(0.5),
      () => new window.THREE.DodecahedronGeometry(0.4)
    ];

    for (let i = 0; i < 6; i++) {
      const geometry = geometries[i % geometries.length]();
      const material = new window.THREE.MeshPhongMaterial({ 
        color: colors[i % colors.length],
        shininess: 100
      });
      const mesh = new window.THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // 円形に配置
      const angle = (i / 6) * Math.PI * 2;
      mesh.position.x = Math.cos(angle) * 3;
      mesh.position.y = Math.sin(angle) * 3;
      mesh.position.z = 0;
      
      scene.add(mesh);
      objects.push({ 
        mesh, 
        speed: 0.5 + Math.random() * 0.5, 
        offset: i * Math.PI / 3,
        originalPosition: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }
      });
    }

    // マウス・タッチイベントリスナー
    const handleMouseMove = (event) => {
      const rect = mount.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // マウス位置に基づいて回転目標を設定
      targetRotationRef.current.x = mouseRef.current.y * 0.5;
      targetRotationRef.current.y = mouseRef.current.x * 0.5;
    };

    const handleTouchMove = (event) => {
      if (event.touches.length > 0) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = mount.getBoundingClientRect();
        mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        targetRotationRef.current.x = mouseRef.current.y * 0.5;
        targetRotationRef.current.y = mouseRef.current.x * 0.5;
      }
    };

    mount.addEventListener('mousemove', handleMouseMove);
    mount.addEventListener('touchmove', handleTouchMove, { passive: false });

    // アニメーションループ
    const animate = () => {
      if (!isVisible) {
        requestAnimationFrame(animate);
        return;
      }

      // スムーズな回転補間
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.05;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.05;

      // メインオブジェクトの回転
      if (objects[0]) {
        objects[0].mesh.rotation.x = currentRotationRef.current.x;
        objects[0].mesh.rotation.y = currentRotationRef.current.y + Date.now() * 0.001;
      }

      // 周りのオブジェクトのアニメーション
      objects.slice(1).forEach((obj, index) => {
        const time = Date.now() * 0.001;
        
        // 回転アニメーション
        obj.mesh.rotation.x = time * obj.speed + obj.offset;
        obj.mesh.rotation.y = time * obj.speed * 0.7 + obj.offset;
        obj.mesh.rotation.z = time * obj.speed * 0.5 + obj.offset;
        
        // 浮遊アニメーション
        if (obj.originalPosition) {
          obj.mesh.position.y = obj.originalPosition.y + Math.sin(time + obj.offset) * 0.3;
          obj.mesh.position.z = obj.originalPosition.z + Math.cos(time * 0.5 + obj.offset) * 0.2;
        }
        
        // マウス位置に基づく微妙な移動
        obj.mesh.position.x += (mouseRef.current.x * 0.2 - obj.mesh.position.x + obj.originalPosition.x) * 0.02;
      });

      // カメラの微妙な動き
      camera.position.x = Math.sin(Date.now() * 0.0005) * 0.1;
      camera.position.y = Math.cos(Date.now() * 0.0007) * 0.1;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    // リサイズハンドラー
    const handleResize = () => {
      if (!mount) return;
      const newWidth = mount.clientWidth;
      const newHeight = mount.clientHeight;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
      
      if (mount && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      
      // Three.jsオブジェクトの適切な破棄
      objects.forEach(obj => {
        if (obj.mesh.geometry) obj.mesh.geometry.dispose();
        if (obj.mesh.material) obj.mesh.material.dispose();
      });
      
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [isVisible]);

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '200px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }} 
    />
  );
};

export default ThreeScene;